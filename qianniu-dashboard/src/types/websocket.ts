// WebSocket 连接状态枚举
export enum WebSocketReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

// WebSocket 连接状态类型
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// WebSocket 消息类型
export interface WebSocketMessage {
  id: string
  type: 'ping' | 'pong' | 'message' | 'notification' | 'error' | 'system' | 'heartbeat' | 'status'
  timestamp: number
  data?: unknown
  ack?: boolean
  direction?: 'incoming' | 'outgoing'
  content?: string
  status?: 'pending' | 'sent' | 'delivered' | 'failed'
}

// 心跳配置
export interface HeartbeatConfig {
  enabled: boolean
  interval: number // 心跳间隔（毫秒）
  timeout: number // 心跳超时（毫秒）
  pingMessage: string
  pongMessage: string
}

// 重连配置
export interface ReconnectConfig {
  enabled: boolean
  maxAttempts: number
  initialDelay: number // 初始延迟（毫秒）
  maxDelay: number // 最大延迟（毫秒）
  backoffFactor: number // 退避因子
  jitter: boolean // 是否添加随机抖动
}

// WebSocket 配置选项
export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  heartbeat: HeartbeatConfig
  reconnect: ReconnectConfig
  messageQueueSize: number
  enableLogging: boolean
  autoConnect: boolean
}

// WebSocket 连接信息
export interface ConnectionInfo {
  url: string
  readyState: WebSocketReadyState
  connectionState: ConnectionState
  connectedAt?: number
  disconnectedAt?: number
  reconnectAttempts: number
  lastError?: string
  latency?: number
}

// WebSocket 事件类型
export interface WebSocketEvents {
  onOpen: (event: Event) => void
  onClose: (event: CloseEvent) => void
  onError: (event: Event) => void
  onMessage: (message: WebSocketMessage) => void
  onReconnect: (attempt: number) => void
  onReconnectFailed: (attempts: number) => void
  onConnectionStateChange: (state: ConnectionState) => void
}

// 消息队列项
export interface QueuedMessage {
  id: string
  message: WebSocketMessage
  timestamp: number
  retries: number
  maxRetries: number
}

// WebSocket 统计信息
export interface WebSocketStats {
  messagesSent: number
  messagesReceived: number
  reconnectCount: number
  errorCount: number
  totalUptime: number
  averageLatency: number
  lastHeartbeat?: number
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected'
}

// WebSocket Hook 返回类型
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
  sendMessage: (message: Omit<WebSocketMessage, 'id' | 'timestamp'>) => void
  sendJsonMessage: (data: unknown, type?: string) => void
  clearHistory: () => void
  clearMessages: () => void
  
  // 配置方法
  updateConfig: (config: Partial<WebSocketConfig>) => void
  
  // 获取原始WebSocket实例（谨慎使用）
  getWebSocket: () => WebSocket | null
}

// WebSocket Hook 配置选项
export interface UseWebSocketOptions {
  config?: Partial<WebSocketConfig>
  events?: Partial<WebSocketEvents>
  filter?: (message: WebSocketMessage) => boolean
  transform?: (message: unknown) => WebSocketMessage
  retryOnError?: boolean
  share?: boolean // 是否在多个组件间共享连接
}

// 错误类型
export interface WebSocketError {
  type: 'connection' | 'message' | 'heartbeat' | 'protocol' | 'unknown'
  message: string
  code?: number
  timestamp: number
  details?: unknown
}

// 默认配置
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfig = {
  url: 'ws://localhost:8080/ws',
  protocols: [],
  heartbeat: {
    enabled: true,
    interval: 30000, // 30秒
    timeout: 10000, // 10秒
    pingMessage: 'ping',
    pongMessage: 'pong',
  },
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    initialDelay: 1000, // 1秒
    maxDelay: 30000, // 30秒
    backoffFactor: 2,
    jitter: true,
  },
  messageQueueSize: 100,
  enableLogging: process.env.NODE_ENV === 'development',
  autoConnect: true,
}

// 默认心跳配置
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: true,
  interval: 30000,
  timeout: 10000,
  pingMessage: 'ping',
  pongMessage: 'pong',
}

// 默认重连配置
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  enabled: true,
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
}

// WebSocket连接历史记录条目
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

// WebSocket连接质量指标
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

// WebSocket实时统计数据
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