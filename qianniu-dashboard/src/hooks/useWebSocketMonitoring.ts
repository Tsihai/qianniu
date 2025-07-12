import { useState, useEffect, useCallback, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { useWebSocket } from './useWebSocket'
import { WebSocketReadyState } from '@/types/websocket'
import type { WebSocketMessage } from '@/types/websocket'

/**
 * WebSocket连接历史记录条目
 * 记录连接过程中的重要事件和状态变化
 */
export interface ConnectionHistoryEntry {
  /** 唯一标识符 */
  id: string
  /** 事件发生时间戳 */
  timestamp: number
  /** 连接事件类型 */
  event: 'connected' | 'disconnected' | 'error' | 'reconnecting'
  /** 连接持续时间（毫秒） */
  duration?: number
  /** 网络延迟（毫秒） */
  latency?: number
  /** 错误信息描述 */
  errorMessage?: string
  /** 重连尝试次数 */
  reconnectAttempt?: number
}

/**
 * WebSocket连接质量指标
 * 提供连接状态的综合评估
 */
export interface ConnectionQuality {
  /** 连接质量评分（0-100） */
  score: number
  /** 连接质量等级 */
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected'
  /** 平均网络延迟（毫秒） */
  latency: number
  /** 连接稳定性百分比（0-100） */
  stability: number
  /** 正常运行时间（秒） */
  uptime: number
  /** 错误率百分比（0-100） */
  errorRate: number
}

/**
 * WebSocket实时统计数据
 * 跟踪连接的各项性能指标
 */
export interface RealtimeStats {
  /** 接收消息总数 */
  messagesReceived: number
  /** 发送消息总数 */
  messagesSent: number
  /** 接收字节总数 */
  bytesReceived: number
  /** 发送字节总数 */
  bytesSent: number
  /** 平均延迟（毫秒） */
  averageLatency: number
  /** 当前延迟（毫秒） */
  currentLatency: number
  /** 连接正常运行时间（毫秒） */
  connectionUptime: number
  /** 重连次数 */
  reconnectCount: number
  /** 错误次数 */
  errorCount: number
  /** 最后心跳时间戳 */
  lastHeartbeat: number
}

/**
 * WebSocket监控配置选项
 * 自定义监控行为和性能参数
 */
export interface WebSocketMonitoringOptions {
  /** 最大历史记录条目数（默认：100） */
  maxHistoryEntries?: number
  /** 延迟检测间隔（毫秒，默认：5000） */
  latencyCheckInterval?: number
  /** 质量更新间隔（毫秒，默认：10000） */
  qualityUpdateInterval?: number
  /** 是否启用延迟监控（默认：true） */
  enableLatencyMonitoring?: boolean
  /** 是否启用带宽监控（默认：true） */
  enableBandwidthMonitoring?: boolean
}

// 监控状态存储
class WebSocketMonitoringStore {
  private listeners = new Set<() => void>()
  private history: ConnectionHistoryEntry[] = []
  private quality: ConnectionQuality = {
    score: 0,
    level: 'disconnected',
    latency: 0,
    stability: 0,
    uptime: 0,
    errorRate: 0,
  }
  private stats: RealtimeStats = {
    messagesReceived: 0,
    messagesSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    averageLatency: 0,
    currentLatency: 0,
    connectionUptime: 0,
    reconnectCount: 0,
    errorCount: 0,
    lastHeartbeat: 0,
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => ({
    history: [...this.history],
    quality: { ...this.quality },
    stats: { ...this.stats },
  })

  updateHistory = (entry: ConnectionHistoryEntry) => {
    this.history.push(entry)
    if (this.history.length > 100) {
      this.history.shift()
    }
    this.notifyListeners()
  }

  updateQuality = (quality: Partial<ConnectionQuality>) => {
    this.quality = { ...this.quality, ...quality }
    this.notifyListeners()
  }

  updateStats = (stats: Partial<RealtimeStats>) => {
    this.stats = { ...this.stats, ...stats }
    this.notifyListeners()
  }

  clearHistory = () => {
    this.history = []
    this.notifyListeners()
  }

  reset = () => {
    this.history = []
    this.quality = {
      score: 0,
      level: 'disconnected',
      latency: 0,
      stability: 0,
      uptime: 0,
      errorRate: 0,
    }
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      averageLatency: 0,
      currentLatency: 0,
      connectionUptime: 0,
      reconnectCount: 0,
      errorCount: 0,
      lastHeartbeat: 0,
    }
    this.notifyListeners()
  }

  private notifyListeners = () => {
    this.listeners.forEach(listener => listener())
  }
}

// 全局监控存储实例
const monitoringStore = new WebSocketMonitoringStore()

/**
 * WebSocket 监控 Hook
 * 提供连接质量监控、历史记录跟踪和实时统计功能
 */
export function useWebSocketMonitoring(
  url: string,
  options: WebSocketMonitoringOptions = {}
) {
  const {
    maxHistoryEntries = 100,
    latencyCheckInterval = 5000,
    qualityUpdateInterval = 10000,
    enableLatencyMonitoring = true,
    enableBandwidthMonitoring = true,
  } = options

  // 使用 useSyncExternalStore 订阅监控数据
  const monitoringData = useSyncExternalStore(
    monitoringStore.subscribe,
    monitoringStore.getSnapshot
  )

  // WebSocket 连接
  const {
    lastMessage,
    readyState,
    sendMessage,
    sendJsonMessage,
    connect,
    reconnect,
    disconnect,
  } = useWebSocket({
    url,
    onOpen: handleConnectionOpen,
    onClose: handleConnectionClose,
    onError: handleConnectionError,
    onMessage: handleMessage,
  })

  // 引用和状态
  const connectionStartTimeRef = useRef<number>(0)
  const latencyCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const qualityUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latencyHistoryRef = useRef<number[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)

  // 连接打开处理
  function handleConnectionOpen(event: Event) {
    const now = Date.now()
    connectionStartTimeRef.current = now
    
    monitoringStore.updateHistory({
      id: `conn-${now}`,
      timestamp: now,
      event: 'connected',
    })

    monitoringStore.updateQuality({
      level: 'good',
      score: 75,
    })

    setIsMonitoring(true)
  }

  // 连接关闭处理
  function handleConnectionClose(event: CloseEvent) {
    const now = Date.now()
    const duration = connectionStartTimeRef.current > 0 
      ? now - connectionStartTimeRef.current 
      : 0

    monitoringStore.updateHistory({
      id: `disconn-${now}`,
      timestamp: now,
      event: 'disconnected',
      duration,
    })

    monitoringStore.updateQuality({
      level: 'disconnected',
      score: 0,
    })

    setIsMonitoring(false)
  }

  // 连接错误处理
  function handleConnectionError(event: Event) {
    const now = Date.now()
    
    monitoringStore.updateHistory({
      id: `error-${now}`,
      timestamp: now,
      event: 'error',
      errorMessage: 'Connection error occurred',
    })

    monitoringStore.updateStats({
      errorCount: monitoringData.stats.errorCount + 1,
    })

    // 更新连接质量
    updateConnectionQuality()
  }

  // 消息处理
  function handleMessage(message: WebSocketMessage) {
    const now = Date.now()
    
    // 更新接收统计
    monitoringStore.updateStats({
      messagesReceived: monitoringData.stats.messagesReceived + 1,
      lastHeartbeat: now,
    })

    // 计算延迟（如果消息包含时间戳）
    if (message.timestamp && enableLatencyMonitoring) {
      const latency = now - message.timestamp
      updateLatency(latency)
    }

    // 计算带宽（如果启用）
    if (enableBandwidthMonitoring) {
      const messageSize = JSON.stringify(message).length
      monitoringStore.updateStats({
        bytesReceived: monitoringData.stats.bytesReceived + messageSize,
      })
    }
  }

  // 更新延迟
  const updateLatency = useCallback((latency: number) => {
    latencyHistoryRef.current.push(latency)
    if (latencyHistoryRef.current.length > 20) {
      latencyHistoryRef.current.shift()
    }

    const averageLatency = latencyHistoryRef.current.reduce((a, b) => a + b, 0) / latencyHistoryRef.current.length
    
    monitoringStore.updateStats({
      currentLatency: latency,
      averageLatency,
    })
  }, [])

  // 更新连接质量
  const updateConnectionQuality = useCallback(() => {
    if (readyState !== WebSocketReadyState.OPEN) {
      monitoringStore.updateQuality({
        level: 'disconnected',
        score: 0,
      })
      return
    }

    const { stats } = monitoringData
    const now = Date.now()
    const uptime = connectionStartTimeRef.current > 0 
      ? now - connectionStartTimeRef.current 
      : 0

    // 计算稳定性（基于错误率和重连次数）
    const totalMessages = stats.messagesReceived + stats.messagesSent
    const errorRate = totalMessages > 0 ? (stats.errorCount / totalMessages) * 100 : 0
    const stability = Math.max(0, 100 - (errorRate * 10) - (stats.reconnectCount * 5))

    // 计算延迟分数
    const latencyScore = stats.averageLatency < 100 ? 100 : 
                        stats.averageLatency < 300 ? 80 : 
                        stats.averageLatency < 500 ? 60 : 
                        stats.averageLatency < 1000 ? 40 : 20

    // 综合分数
    const score = Math.round((stability * 0.4) + (latencyScore * 0.4) + (uptime > 60000 ? 20 : (uptime / 60000) * 20))

    // 确定质量等级 - 使用类型守卫确保类型安全
    const getQualityLevel = (score: number): ConnectionQuality['level'] => {
      if (score >= 90) return 'excellent'
      if (score >= 75) return 'good'
      if (score >= 50) return 'fair'
      return 'poor'
    }
    
    const level = getQualityLevel(score)

    monitoringStore.updateQuality({
      score,
      level,
      latency: stats.averageLatency,
      stability,
      uptime: uptime / 1000, // 转换为秒
      errorRate,
    })
  }, [readyState])

  // 发送带监控的消息
  const sendMonitoredMessage = useCallback((message: string | object) => {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
    sendMessage(messageStr)
    
    // 更新发送统计
    const currentStats = monitoringStore.getSnapshot().stats
    monitoringStore.updateStats({
      messagesSent: currentStats.messagesSent + 1,
    })

    if (enableBandwidthMonitoring) {
      monitoringStore.updateStats({
        bytesSent: currentStats.bytesSent + messageStr.length,
      })
    }
  }, [sendMessage, enableBandwidthMonitoring])

  // 发送带监控的JSON消息
  const sendMonitoredJsonMessage = useCallback((message: object) => {
    const messageStr = JSON.stringify(message)
    sendJsonMessage(message)
    
    // 更新发送统计
    const currentStats = monitoringStore.getSnapshot().stats
    monitoringStore.updateStats({
      messagesSent: currentStats.messagesSent + 1,
    })

    if (enableBandwidthMonitoring) {
      monitoringStore.updateStats({
        bytesSent: currentStats.bytesSent + messageStr.length,
      })
    }
  }, [sendJsonMessage, enableBandwidthMonitoring])

  // 延迟检测
  useEffect(() => {
    if (!enableLatencyMonitoring || readyState !== WebSocketReadyState.OPEN) {
      return
    }

    const checkLatency = () => {
      const pingTime = Date.now()
      sendMonitoredJsonMessage({
        type: 'ping',
        timestamp: pingTime,
      })
    }

    latencyCheckTimeoutRef.current = setInterval(checkLatency, latencyCheckInterval)

    return () => {
      if (latencyCheckTimeoutRef.current) {
        clearInterval(latencyCheckTimeoutRef.current)
      }
    }
  }, [enableLatencyMonitoring, readyState, latencyCheckInterval, sendMonitoredJsonMessage])

  // 质量更新
  useEffect(() => {
    if (!isMonitoring) return

    qualityUpdateTimeoutRef.current = setInterval(updateConnectionQuality, qualityUpdateInterval)

    return () => {
      if (qualityUpdateTimeoutRef.current) {
        clearInterval(qualityUpdateTimeoutRef.current)
      }
    }
  }, [isMonitoring, qualityUpdateInterval, updateConnectionQuality])

  // 清理函数
  useEffect(() => {
    return () => {
      if (latencyCheckTimeoutRef.current) {
        clearInterval(latencyCheckTimeoutRef.current)
      }
      if (qualityUpdateTimeoutRef.current) {
        clearInterval(qualityUpdateTimeoutRef.current)
      }
    }
  }, [])

  return {
    // 基础 WebSocket 功能
    lastMessage,
    readyState,
    reconnect,
    disconnect,
    
    // 监控数据
    connectionHistory: monitoringData.history,
    connectionQuality: monitoringData.quality,
    realtimeStats: monitoringData.stats,
    
    // 监控操作
    sendMessage: sendMonitoredMessage,
    sendJsonMessage: sendMonitoredJsonMessage,
    clearHistory: monitoringStore.clearHistory,
    resetMonitoring: monitoringStore.reset,
    
    // 状态
    isMonitoring,
  }
}

/**
 * 获取连接质量颜色
 */
export function getQualityColor(level: ConnectionQuality['level']): string {
  switch (level) {
    case 'excellent':
      return 'text-green-600'
    case 'good':
      return 'text-blue-600'
    case 'fair':
      return 'text-yellow-600'
    case 'poor':
      return 'text-red-600'
    case 'disconnected':
      return 'text-gray-400'
    default:
      return 'text-gray-400'
  }
}

/**
 * 获取连接质量描述
 */
export function getQualityDescription(level: ConnectionQuality['level']): string {
  switch (level) {
    case 'excellent':
      return '连接优秀'
    case 'good':
      return '连接良好'
    case 'fair':
      return '连接一般'
    case 'poor':
      return '连接较差'
    case 'disconnected':
      return '连接断开'
    default:
      return '未知状态'
  }
}