"use client"

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, useTransition } from 'react'
import { useWebSocket } from './useWebSocket'
import { useLocalStorage } from './useLocalStorage'
import type { 
  WebSocketMessage, 
  Message, 
  Agent, 
  SystemStats,
  Notification 
} from '@/types'
import { WS_MESSAGE_TYPE } from '@/lib/constants'
import { ExternalStore, createExternalStore } from '../lib/externalStore'
import { getGlobalCache } from '../lib/dataCache'

// 实时数据状态接口
export interface RealTimeDataState {
  /** 消息列表 */
  messages: Message[]
  /** 客服列表 */
  agents: Agent[]
  /** 系统统计 */
  systemStats: SystemStats | null
  /** 通知列表 */
  notifications: Notification[]
  /** 连接状态 */
  isConnected: boolean
  /** 最后更新时间 */
  lastUpdate: number
  /** 错误信息 */
  error: string | null
}

// Hook 配置选项
export interface UseRealTimeDataOptions {
  /** 最大消息数量 */
  maxMessages?: number
  /** 最大通知数量 */
  maxNotifications?: number
  /** 是否启用本地存储 */
  enableStorage?: boolean
  /** 存储键前缀 */
  storagePrefix?: string
  /** 是否自动连接 */
  autoConnect?: boolean
  /** 是否自动重连 */
  autoReconnect?: boolean
  /** 重连间隔（毫秒） */
  reconnectInterval?: number
  /** 数据更新回调 */
  onDataUpdate?: (data: RealTimeDataState) => void
  /** 错误回调 */
  onError?: (error: string) => void
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 缓存TTL（毫秒） */
  cacheTTL?: number
  /** 是否启用离线恢复 */
  enableOfflineRecovery?: boolean
  /** 是否使用Transition更新 */
  useTransition?: boolean
  onNewMessage?: (message: Message) => void
  onAgentStatusChange?: (agent: Agent) => void
  onSystemStatsUpdate?: (stats: SystemStats) => void
  onNotification?: (notification: Notification) => void
}

// Hook 返回值接口
export interface UseRealTimeDataReturn {
  /** 实时数据状态 */
  data: RealTimeDataState
  /** 添加消息 */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  /** 更新客服状态 */
  updateAgent: (agentId: string, updates: Partial<Agent>) => void
  /** 更新系统统计 */
  updateSystemStats: (stats: Partial<SystemStats>) => void
  /** 添加通知 */
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  /** 清空通知 */
  clearNotifications: () => void
  /** 删除通知 */
  removeNotification: (id: string) => void
  /** 重连 */
  reconnect: () => void
  /** 断开连接 */
  disconnect: () => void
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在等待状态更新 */
  isPending: boolean
  /** 清除缓存 */
  clearCache: () => Promise<void>
  /** 获取缓存信息 */
  getCacheInfo: () => Promise<any>
}

/**
 * useRealTimeData Hook
 * 管理实时数据状态，处理WebSocket消息并更新相应的数据
 * 
 * @param options - 配置选项
 * @returns 实时数据状态和操作方法
 */
// 默认配置
const DEFAULT_OPTIONS: Required<UseRealTimeDataOptions> = {
  maxMessages: 1000,
  maxNotifications: 50,
  enableStorage: true,
  storagePrefix: 'qianniu-realtime',
  autoConnect: true,
  autoReconnect: true,
  reconnectInterval: 5000,
  onDataUpdate: () => {},
  onError: () => {},
  enableCache: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24小时
  enableOfflineRecovery: true,
  useTransition: true,
  onNewMessage: () => {},
  onAgentStatusChange: () => {},
  onSystemStatsUpdate: () => {},
  onNotification: () => {}
}

// 初始状态
const INITIAL_STATE: RealTimeDataState = {
  messages: [],
  agents: [],
  systemStats: null,
  notifications: [],
  isConnected: false,
  lastUpdate: Date.now(),
  error: null
}

// 创建外部存储
const realTimeDataStore = createExternalStore<RealTimeDataState>(INITIAL_STATE)

export function useRealTimeData(
  options: UseRealTimeDataOptions = {}
): UseRealTimeDataReturn {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const {
    maxMessages,
    maxNotifications,
    enableStorage,
    storagePrefix,
    autoReconnect,
    reconnectInterval,
    onDataUpdate,
    onError,
    enableCache,
    cacheTTL,
    enableOfflineRecovery,
    useTransition: useTransitionUpdates,
    onNewMessage,
    onAgentStatusChange,
    onSystemStatsUpdate,
    onNotification,
  } = config

  // 使用外部存储
  const storeState = useSyncExternalStore(
    realTimeDataStore.subscribe,
    realTimeDataStore.getSnapshot,
    realTimeDataStore.getServerSnapshot
  )
  
  const data = storeState.data

  // 使用Transition进行非阻塞更新
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 本地存储
  const [storedData, setStoredData] = enableStorage 
    ? useLocalStorage<Partial<RealTimeDataState>>(
        `${storagePrefix}-data`,
        {}
      )
    : [null, () => {}, () => {}] as const

  // 缓存管理
  const cache = useRef(getGlobalCache())
  const lastSyncRef = useRef<number>(Date.now())

  // 引用管理
  const configRef = useRef(config)
  configRef.current = config

  // 更新存储状态的辅助函数
  const updateStore = useCallback(async (updater: (prev: RealTimeDataState) => RealTimeDataState) => {
    const currentState = realTimeDataStore.getState()
    const newData = updater(currentState.data)
    
    if (useTransitionUpdates) {
      startTransition(async () => {
        await realTimeDataStore.setData(newData)
      })
    } else {
      await realTimeDataStore.setData(newData)
    }
  }, [useTransitionUpdates])

  // WebSocket消息处理
  const handleWebSocketMessage = useCallback(async (wsMessage: WebSocketMessage) => {
    const now = Date.now()

    switch (wsMessage.type) {
      case WS_MESSAGE_TYPE.MESSAGE:
        if (wsMessage.data && typeof wsMessage.data === 'object') {
          const message = wsMessage.data as Message
          await updateStore(prev => ({
            ...prev,
            messages: [message, ...prev.messages].slice(0, maxMessages),
            lastUpdate: now
          }))
          onNewMessage?.(message)
        }
        break

      case WS_MESSAGE_TYPE.STATUS:
        if (wsMessage.data && typeof wsMessage.data === 'object') {
          const agentData = wsMessage.data as Agent
          await updateStore(prev => {
            const existingIndex = prev.agents.findIndex(agent => agent.id === agentData.id)
            let updatedAgents: Agent[]
            if (existingIndex >= 0) {
              updatedAgents = [...prev.agents]
              updatedAgents[existingIndex] = agentData
            } else {
              updatedAgents = [...prev.agents, agentData]
            }
            return {
              ...prev,
              agents: updatedAgents,
              lastUpdate: now
            }
          })
          onAgentStatusChange?.(agentData)
        }
        break

      case WS_MESSAGE_TYPE.NOTIFICATION:
        if (wsMessage.data && typeof wsMessage.data === 'object') {
          const notification = wsMessage.data as Notification
          await updateStore(prev => ({
            ...prev,
            notifications: [notification, ...prev.notifications].slice(0, maxNotifications),
            lastUpdate: now
          }))
          onNotification?.(notification)
        }
        break

      default:
        // 处理系统统计数据或其他类型的消息
        if (wsMessage.data && typeof wsMessage.data === 'object' && 'totalMessages' in wsMessage.data) {
          const stats = wsMessage.data as SystemStats
          await updateStore(prev => ({
            ...prev,
            systemStats: stats,
            lastUpdate: now
          }))
          onSystemStatsUpdate?.(stats)
        }
        break
    }
  }, [maxMessages, maxNotifications, onNewMessage, onAgentStatusChange, onSystemStatsUpdate, onNotification, updateStore])

  // WebSocket连接
  const {
    readyState,
    reconnect: wsReconnect,
    disconnect: wsDisconnect
  } = useWebSocket({
    shouldReconnect: autoReconnect,
    onMessage: handleWebSocketMessage,
    onOpen: async () => {
      console.log('实时数据连接已建立')
      await updateStore(prev => ({ ...prev, isConnected: true, error: null }))
    },
    onClose: async () => {
      console.log('实时数据连接已断开')
      await updateStore(prev => ({ ...prev, isConnected: false }))
    },
    onError: async (error) => {
      console.error('实时数据连接错误:', error)
      setError('WebSocket连接错误')
      await updateStore(prev => ({ ...prev, error: 'WebSocket连接错误' }))
    }
  })

  // 手动添加消息
  const addMessage = useCallback(async (messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const message: Message = {
      ...messageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    await updateStore(prev => ({
      ...prev,
      messages: [message, ...prev.messages].slice(0, maxMessages),
      lastUpdate: Date.now()
    }))
    
    onNewMessage?.(message)
  }, [maxMessages, onNewMessage, updateStore])

  // 更新客服状态
  const updateAgent = useCallback(async (agentId: string, updates: Partial<Agent>) => {
    await updateStore(prev => {
      const existingIndex = prev.agents.findIndex(a => a.id === agentId)
      let updatedAgents: Agent[]
      
      if (existingIndex >= 0) {
        updatedAgents = [...prev.agents]
        updatedAgents[existingIndex] = { ...updatedAgents[existingIndex], ...updates }
      } else {
        const newAgent: Agent = {
          id: agentId,
          name: '',
          status: 'offline',
          avatar: '',
          ...updates
        } as Agent
        updatedAgents = [...prev.agents, newAgent]
      }
      
      const updatedAgent = updatedAgents.find(a => a.id === agentId)
      if (updatedAgent) {
        onAgentStatusChange?.(updatedAgent)
      }
      
      return {
        ...prev,
        agents: updatedAgents,
        lastUpdate: Date.now()
      }
    })
  }, [onAgentStatusChange, updateStore])

  // 更新系统统计
  const updateSystemStats = useCallback(async (stats: Partial<SystemStats>) => {
    await updateStore(prev => {
      const updatedStats = prev.systemStats ? { ...prev.systemStats, ...stats } : stats as SystemStats
      onSystemStatsUpdate?.(updatedStats)
      
      return {
        ...prev,
        systemStats: updatedStats,
        lastUpdate: Date.now()
      }
    })
  }, [onSystemStatsUpdate, updateStore])

  // 添加通知
  const addNotification = useCallback(async (notificationData: Omit<Notification, 'id' | 'timestamp'>) => {
    const notification: Notification = {
      ...notificationData,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    await updateStore(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications].slice(0, maxNotifications),
      lastUpdate: Date.now()
    }))
    
    onNotification?.(notification)
  }, [maxNotifications, onNotification, updateStore])
  
  // 清除通知
  const clearNotifications = useCallback(async () => {
    await updateStore(prev => ({
      ...prev,
      notifications: [],
      lastUpdate: Date.now()
    }))
  }, [updateStore])

  // 删除指定通知
  const removeNotification = useCallback((id: string) => {
    updateStore(prev => ({
      ...prev,
      notifications: prev.notifications.filter(notification => notification.id !== id),
      lastUpdate: Date.now()
    }))
  }, [updateStore])

  // 重连
  const reconnect = useCallback(() => {
    wsReconnect()
  }, [wsReconnect])

  // 断开连接
  const disconnect = useCallback(() => {
    wsDisconnect()
  }, [wsDisconnect])

  // 缓存控制方法
  const clearCache = useCallback(async () => {
    if (enableCache) {
      await cache.current.clearAll()
    }
  }, [enableCache])

  const getCacheInfo = useCallback(async () => {
    if (enableCache) {
      return await cache.current.getStats()
    }
    return null
  }, [enableCache])

  // 数据持久化
  useEffect(() => {
    if (enableStorage && data.lastUpdate > lastSyncRef.current) {
      setStoredData({
        messages: data.messages.slice(0, 100), // 只存储最近100条消息
        agents: data.agents,
        systemStats: data.systemStats,
        notifications: data.notifications.slice(0, 20), // 只存储最近20条通知
        lastUpdate: data.lastUpdate
      })
      lastSyncRef.current = data.lastUpdate
    }
  }, [data, enableStorage, setStoredData])

  // 离线恢复
  useEffect(() => {
    if (enableOfflineRecovery && storedData && Object.keys(storedData).length > 0) {
      updateStore(prev => ({
        ...prev,
        ...storedData,
        isConnected: prev.isConnected // 保持当前连接状态
      }))
    }
  }, [enableOfflineRecovery, storedData, updateStore])

  // 数据更新回调
  useEffect(() => {
    onDataUpdate?.(data)
  }, [data, onDataUpdate])

  // 错误处理
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  return {
    data,
    addMessage,
    updateAgent,
    updateSystemStats,
    addNotification,
    clearNotifications,
    removeNotification,
    reconnect,
    disconnect,
    isLoading,
    error: error || data.error || (storeState.error ? storeState.error.message : null),
    isPending,
    clearCache,
    getCacheInfo
  }
}

/**
 * useMessageFilter Hook
 * 提供消息过滤功能
 */
export function useMessageFilter(messages: Message[]) {
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    searchText: '',
    dateRange: { start: '', end: '' }
  })

  const filteredMessages = useCallback(() => {
    return messages.filter(message => {
      // 状态过滤
      if (filters.status && message.status !== filters.status) {
        return false
      }

      // 优先级过滤
      if (filters.priority && message.priority !== filters.priority) {
        return false
      }

      // 类别过滤
      if (filters.category && message.category !== filters.category) {
        return false
      }

      // 文本搜索
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase()
        const contentMatch = message.content.toLowerCase().includes(searchLower)
        const customerMatch = message.customerName?.toLowerCase().includes(searchLower)
        if (!contentMatch && !customerMatch) {
          return false
        }
      }

      // 日期范围过滤
      if (filters.dateRange.start || filters.dateRange.end) {
        const messageDate = new Date(message.timestamp)
        if (filters.dateRange.start && messageDate < new Date(filters.dateRange.start)) {
          return false
        }
        if (filters.dateRange.end && messageDate > new Date(filters.dateRange.end)) {
          return false
        }
      }

      return true
    })
  }, [messages, filters])

  return {
    filters,
    setFilters,
    filteredMessages: filteredMessages(),
    clearFilters: () => setFilters({
      status: '',
      priority: '',
      category: '',
      searchText: '',
      dateRange: { start: '', end: '' }
    })
  }
}

/**
 * useNotificationManager Hook
 * 管理通知的显示和自动清理
 */
export function useNotificationManager(notifications: Notification[]) {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([])
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // 自动清理通知
  useEffect(() => {
    notifications.forEach(notification => {
      if (!timeoutRefs.current.has(notification.id)) {
        const timeout = setTimeout(() => {
          setVisibleNotifications(prev => 
            prev.filter(n => n.id !== notification.id)
          )
          timeoutRefs.current.delete(notification.id)
        }, 5000) // 5秒后自动清理

        timeoutRefs.current.set(notification.id, timeout)
      }
    })

    setVisibleNotifications(notifications)

    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      timeoutRefs.current.clear()
    }
  }, [notifications])

  const dismissNotification = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutRefs.current.delete(id)
    }
    setVisibleNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return {
    visibleNotifications,
    dismissNotification
  }
}