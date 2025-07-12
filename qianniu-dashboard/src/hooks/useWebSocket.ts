'use client'

import { useState, useEffect, useRef, useCallback, useSyncExternalStore, useTransition, useMemo } from 'react'
import { WEBSOCKET_CONFIG, WS_MESSAGE_TYPE } from '@/lib/constants'
import {
  WebSocketConfig,
  WebSocketReadyState,
  ConnectionState,
  ConnectionInfo,
  WebSocketStats,
  UseWebSocketReturn as NewUseWebSocketReturn,
  UseWebSocketOptions,
  WebSocketEvents,
  WebSocketMessage,
  DEFAULT_WEBSOCKET_CONFIG,
} from '@/types/websocket'
import { WebSocketClient } from '@/lib/websocket'
import { ExternalStore, createExternalStore } from '../lib/externalStore'
import { getGlobalCache } from '../lib/dataCache'

// 导出WebSocketReadyState以保持向后兼容
export { WebSocketReadyState as ReadyState }
// 导出WebSocketMessage类型以保持向后兼容
export type { WebSocketMessage }

// 向后兼容的WebSocket配置选项
export interface WebSocketOptions {
  url?: string
  protocols?: string | string[]
  shouldReconnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
  heartbeatInterval?: number
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onMessage?: (message: WebSocketMessage) => void
  filter?: (message: WebSocketMessage) => boolean
  // React 19 优化选项
  useTransition?: boolean
  enableCache?: boolean
  cacheTTL?: number
  enableOfflineRecovery?: boolean
  storeKey?: string
}

// 向后兼容的Hook返回值类型
export interface UseWebSocketReturn {
  // 连接状态
  connectionState: ConnectionState
  connectionStatus: ConnectionState // 别名，保持兼容性
  readyState: WebSocketReadyState
  connectionInfo: ConnectionInfo
  stats: WebSocketStats
  
  // 消息处理
  lastMessage: WebSocketMessage | null
  messageHistory: WebSocketMessage[]
  messages: WebSocketMessage[]
  
  // 操作方法
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  sendMessage: (message: string | ArrayBufferLike | Blob | ArrayBufferView) => void
  sendJsonMessage: (message: unknown) => void
  getWebSocket: () => WebSocket | null
  clearHistory: () => void
  clearMessages: () => void
  
  // React 19 优化相关
  isPending: boolean
  clearCache: () => Promise<void>
  getCacheInfo: () => Promise<{ size: number; lastUpdated: number | null }>
}

/**
 * useWebSocket Hook
 * 管理WebSocket连接，提供自动重连、心跳检测等功能
 * 
 * @param options - WebSocket配置选项
 * @returns WebSocket连接状态和操作方法
 */
export function useWebSocket(options: WebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = WEBSOCKET_CONFIG.URL,
    protocols,
    shouldReconnect = true,
    reconnectAttempts = WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS,
    reconnectInterval = WEBSOCKET_CONFIG.RECONNECT_INTERVAL,
    heartbeatInterval = WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL,
    onOpen,
    onClose,
    onError,
    onMessage,
    filter,
    // React 19 优化选项
    useTransition: useTransitionOpt = true,
    enableCache = true,
    cacheTTL = 300000, // 5分钟
    enableOfflineRecovery = true,
    storeKey = 'websocket-store',
  } = options

  // React 19 优化：使用 useTransition
  const [isPending, startTransition] = useTransition()
  
  // 创建外部存储用于WebSocket状态
  const wsStore = useMemo(() => {
    return createExternalStore<{
      lastMessage: WebSocketMessage | null
      readyState: WebSocketReadyState
    }>({
      lastMessage: null,
      readyState: WebSocketReadyState.CONNECTING
    }, {
      cacheKey: storeKey,
      enableCache,
      cacheTTL,
      enableOfflineRecovery,
      cacheStore: 'WEBSOCKET_DATA'
    })
  }, [storeKey, enableCache, cacheTTL, enableOfflineRecovery])
  
  // 使用 useSyncExternalStore 订阅状态变化
  const wsState = useSyncExternalStore(
    wsStore.subscribe,
    wsStore.getSnapshot,
    () => ({ 
      data: { lastMessage: null, readyState: WebSocketReadyState.CONNECTING },
      loading: false,
      error: null,
      lastUpdated: Date.now(),
      version: 0
    }) // SSR fallback
  )
  
  const { lastMessage, readyState } = wsState.data
  
  // 缓存管理
  const cache = useMemo(() => getGlobalCache(), [])
  
  // 引用管理
  const webSocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(shouldReconnect)
  const urlRef = useRef(url)

  // 更新引用值
  useEffect(() => {
    shouldReconnectRef.current = shouldReconnect
    urlRef.current = url
  }, [shouldReconnect, url])

  // 清理定时器
  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // 发送心跳
  const sendHeartbeat = useCallback(() => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      const heartbeatMessage = {
        type: WS_MESSAGE_TYPE.HEARTBEAT,
        timestamp: Date.now(),
        data: 'ping'
      }
      webSocketRef.current.send(JSON.stringify(heartbeatMessage))
    }
  }, [])

  // 启动心跳检测
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval > 0) {
      heartbeatTimeoutRef.current = setInterval(sendHeartbeat, heartbeatInterval)
    }
  }, [heartbeatInterval, sendHeartbeat])

  // 停止心跳检测
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // 连接WebSocket
  const connect = useCallback(() => {
    try {
      // 关闭现有连接
      if (webSocketRef.current) {
        webSocketRef.current.close()
      }

      // 创建新连接
      const ws = new WebSocket(urlRef.current, protocols)
      webSocketRef.current = ws
      
      const updateConnectingState = () => {
        wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CONNECTING })
      }
      
      if (useTransitionOpt) {
        startTransition(updateConnectingState)
      } else {
        updateConnectingState()
      }

      // 连接打开事件
      ws.onopen = (event) => {
        const updateState = () => {
          wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.OPEN })
        }
        
        if (useTransitionOpt) {
          startTransition(updateState)
        } else {
          updateState()
        }
        
        reconnectAttemptsRef.current = 0
        startHeartbeat()
        onOpen?.(event)
        console.log('WebSocket连接已建立')
      }

      // 接收消息事件
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          // 处理心跳响应
          if (message.type === WS_MESSAGE_TYPE.HEARTBEAT) {
            return
          }

          // 应用过滤器
          if (filter && !filter(message)) {
            return
          }

          const updateState = () => {
            wsStore.setData({ ...wsStore.getState().data, lastMessage: message })
          }
          
          if (useTransitionOpt) {
            startTransition(updateState)
          } else {
            updateState()
          }
          
          onMessage?.(message)
        } catch (_error) {
          console.warn('解析WebSocket消息失败:', _error)
        }
      }

      // 连接关闭事件
      ws.onclose = (event) => {
        const updateState = () => {
          wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CLOSED })
        }
        
        if (useTransitionOpt) {
          startTransition(updateState)
        } else {
          updateState()
        }
        
        stopHeartbeat()
        onClose?.(event)
        
        console.log('WebSocket连接已关闭', event.code, event.reason)

        // 自动重连逻辑
        if (
          shouldReconnectRef.current &&
          reconnectAttemptsRef.current < reconnectAttempts &&
          !event.wasClean
        ) {
          reconnectAttemptsRef.current += 1
          console.log(`尝试重连 (${reconnectAttemptsRef.current}/${reconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      // 连接错误事件
      ws.onerror = (event) => {
        const updateState = () => {
          wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CLOSED })
        }
        
        if (useTransitionOpt) {
          startTransition(updateState)
        } else {
          updateState()
        }
        
        console.error('WebSocket连接错误:', event)
        onError?.(event)
      }

    } catch (_error) {
      console.error('创建WebSocket连接失败:', _error)
      const updateState = () => {
        wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CLOSED })
      }
      
      if (useTransitionOpt) {
        startTransition(updateState)
      } else {
        updateState()
      }
    }
  }, [protocols, reconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage, filter, startHeartbeat, stopHeartbeat])

  // 手动重连
  const reconnect = useCallback(() => {
    clearTimeouts()
    reconnectAttemptsRef.current = 0
    
    const updateState = () => {
      wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CONNECTING })
    }
    
    if (useTransitionOpt) {
      startTransition(updateState)
    } else {
      updateState()
    }
    
    connect()
  }, [connect, clearTimeouts, wsStore, useTransitionOpt, startTransition])

  // 断开连接
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    clearTimeouts()
    stopHeartbeat()
    
    if (webSocketRef.current) {
      webSocketRef.current.close(1000, '用户主动断开连接')
      webSocketRef.current = null
    }
    
    const updateState = () => {
      wsStore.setData({ ...wsStore.getState().data, readyState: WebSocketReadyState.CLOSED })
    }
    
    if (useTransitionOpt) {
      startTransition(updateState)
    } else {
      updateState()
    }
  }, [clearTimeouts, stopHeartbeat, wsStore, useTransitionOpt, startTransition])

  // 发送消息
  const sendMessage = useCallback((message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(message)
    } else {
      console.warn('WebSocket未连接，无法发送消息')
    }
  }, [])

  // 发送JSON消息
  const sendJsonMessage = useCallback((message: unknown) => {
    try {
      const jsonMessage = JSON.stringify(message)
      sendMessage(jsonMessage)
    } catch (_error) {
      console.error('序列化消息失败:', _error)
    }
  }, [sendMessage])

  // 获取WebSocket实例
  const getWebSocket = useCallback(() => {
    return webSocketRef.current
  }, [])

  // 初始化连接
  useEffect(() => {
    connect()

    // 清理函数
    return () => {
      shouldReconnectRef.current = false
      clearTimeouts()
      stopHeartbeat()
      
      if (webSocketRef.current) {
        webSocketRef.current.close(1000, '组件卸载')
      }
    }
  }, []) // 只在组件挂载时执行一次

  // 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时停止心跳
        stopHeartbeat()
      } else {
        // 页面显示时恢复心跳
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
          startHeartbeat()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [startHeartbeat, stopHeartbeat])

  // 计算连接状态
  const connectionStatus = useMemo(() => {
    switch (readyState) {
      case WebSocketReadyState.CONNECTING:
        return reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting'
      case WebSocketReadyState.OPEN:
        return 'connected'
      case WebSocketReadyState.CLOSING:
      case WebSocketReadyState.CLOSED:
        return 'disconnected'
      default:
        return 'error'
    }
  }, [readyState])

  // 消息历史管理
  const [messageHistory, setMessageHistory] = useState<WebSocketMessage[]>([])
  
  // 添加消息到历史记录
  useEffect(() => {
    if (lastMessage) {
      setMessageHistory(prev => [...prev.slice(-99), lastMessage]) // 保留最近100条消息
    }
  }, [lastMessage])
  
  // 清理消息历史
  const clearHistory = useCallback(() => {
    setMessageHistory([])
  }, [])
  
  const clearMessages = useCallback(() => {
    setMessageHistory([])
  }, [])
  
  // 连接信息
  const connectionInfo = useMemo((): ConnectionInfo => ({
    url: urlRef.current,
    readyState,
    connectionState: connectionStatus,
    reconnectAttempts: reconnectAttemptsRef.current,
    connectedAt: readyState === WebSocketReadyState.OPEN ? Date.now() : undefined,
    disconnectedAt: readyState === WebSocketReadyState.CLOSED ? Date.now() : undefined,
    latency: undefined // 可以后续添加延迟测量
  }), [readyState, connectionStatus])
  
  // 统计信息
  const stats = useMemo((): WebSocketStats => ({
    messagesSent: 0, // 可以后续添加发送消息计数
    messagesReceived: messageHistory.length,
    reconnectCount: reconnectAttemptsRef.current,
    errorCount: 0, // 可以后续添加错误计数
    totalUptime: 0, // 可以后续添加运行时间计算
    averageLatency: 0, // 可以后续添加平均延迟计算
    lastHeartbeat: undefined,
    connectionQuality: readyState === WebSocketReadyState.OPEN ? 'good' : 'disconnected'
  }), [messageHistory.length, readyState])

  // 缓存管理函数
  const clearCache = useCallback(async () => {
    cache.clear('WEBSOCKET_DATA')
    await wsStore.clearCache()
  }, [cache, wsStore])
  
  const getCacheInfo = useCallback(async () => {
    const storeInfo = await wsStore.getCacheInfo()
    return {
      size: storeInfo?.data ? 1 : 0,
      lastUpdated: storeInfo?.data?.lastUpdated || null
    }
  }, [wsStore])
  
  // 离线恢复
  useEffect(() => {
    if (enableOfflineRecovery) {
      // ExternalStore会在初始化时自动从缓存恢复数据
      // 这里不需要手动处理
    }
  }, [enableOfflineRecovery])

  return {
    // 连接状态
    connectionState: connectionStatus,
    connectionStatus, // 别名，保持兼容性
    readyState,
    connectionInfo,
    stats,
    
    // 消息处理
    lastMessage,
    messageHistory,
    messages: messageHistory, // 别名，保持兼容性
    
    // 操作方法
    connect,
    disconnect,
    reconnect,
    sendMessage,
    sendJsonMessage,
    getWebSocket,
    clearHistory,
    clearMessages,
    
    // React 19 优化相关
    isPending,
    clearCache,
    getCacheInfo,
  }
}

/**
 * 获取连接状态的可读文本
 */
export function getReadyStateText(readyState: WebSocketReadyState): string {
  switch (readyState) {
    case WebSocketReadyState.CONNECTING:
      return '连接中'
    case WebSocketReadyState.OPEN:
      return '已连接'
    case WebSocketReadyState.CLOSING:
      return '断开中'
    case WebSocketReadyState.CLOSED:
      return '已断开'
    default:
      return '未知状态'
  }
}