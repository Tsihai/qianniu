import {
  WebSocketConfig,
  WebSocketMessage,
  WebSocketReadyState,
  ConnectionState,
  ConnectionInfo,
  WebSocketEvents,
  QueuedMessage,
  WebSocketStats,
  WebSocketError,
  DEFAULT_WEBSOCKET_CONFIG,
} from '@/types/websocket'

/**
 * WebSocket 客户端类
 * 提供连接管理、心跳检测、自动重连、消息队列等功能
 */
export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private connectionInfo: ConnectionInfo
  private stats: WebSocketStats
  private events: Partial<WebSocketEvents> = {}
  
  // 心跳相关
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
  private lastHeartbeatTime = 0
  
  // 重连相关
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private isReconnecting = false
  
  // 消息队列
  private messageQueue: QueuedMessage[] = []
  private pendingMessages = new Map<string, QueuedMessage>()
  
  // 状态管理
  private connectionState: ConnectionState = 'disconnected'
  private isDestroyed = false
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_WEBSOCKET_CONFIG, ...config }
    this.connectionInfo = {
      url: this.config.url,
      readyState: WebSocketReadyState.UNINSTANTIATED,
      connectionState: 'disconnected',
      reconnectAttempts: 0,
    }
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
      errorCount: 0,
      totalUptime: 0,
      averageLatency: 0,
      connectionQuality: 'disconnected',
    }
    
    // 监听页面可见性变化
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    }
    
    // 监听网络状态变化
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      window.addEventListener('online', this.handleOnline.bind(this))
      window.addEventListener('offline', this.handleOffline.bind(this))
    }
  }
  
  /**
   * 连接WebSocket
   */
  public connect(): void {
    if (this.isDestroyed) {
      this.log('warn', 'WebSocket client has been destroyed')
      return
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log('warn', 'WebSocket is already connected')
      return
    }
    
    this.setConnectionState('connecting')
    
    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols)
      this.setupEventListeners()
      this.log('info', `Connecting to ${this.config.url}`)
    } catch (error) {
      this.handleError('connection', 'Failed to create WebSocket connection', error)
    }
  }
  
  /**
   * 断开WebSocket连接
   */
  public disconnect(): void {
    this.isReconnecting = false
    this.clearTimers()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
    }
    
    this.setConnectionState('disconnected')
  }
  
  /**
   * 手动重连
   */
  public reconnect(): void {
    this.disconnect()
    setTimeout(() => this.connect(), 100)
  }
  
  /**
   * 发送消息
   */
  public sendMessage(message: Omit<WebSocketMessage, 'id' | 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      ...message,
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.doSendMessage(fullMessage)
    } else {
      this.queueMessage(fullMessage)
    }
  }
  
  /**
   * 发送JSON消息
   */
  public sendJsonMessage(data: unknown, type = 'message'): void {
    this.sendMessage({ type: type as WebSocketMessage['type'], data })
  }
  
  /**
   * 注册事件监听器
   */
  public on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    this.events[event] = handler
  }
  
  /**
   * 移除事件监听器
   */
  public off<K extends keyof WebSocketEvents>(event: K): void {
    delete this.events[event]
  }
  
  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<WebSocketConfig>): void {
    const oldUrl = this.config.url
    this.config = { ...this.config, ...newConfig }
    
    // 如果URL发生变化，需要重新连接
    if (oldUrl !== this.config.url && this.connectionState === 'connected') {
      this.reconnect()
    }
  }
  
  /**
   * 获取连接信息
   */
  public getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo }
  }
  
  /**
   * 获取统计信息
   */
  public getStats(): WebSocketStats {
    return { ...this.stats }
  }
  
  /**
   * 获取原始WebSocket实例
   */
  public getWebSocket(): WebSocket | null {
    return this.ws
  }
  
  /**
   * 销毁WebSocket客户端
   */
  public destroy(): void {
    this.isDestroyed = true
    this.disconnect()
    this.clearTimers()
    this.messageQueue = []
    this.pendingMessages.clear()
    
    // 移除事件监听器
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this))
      window.removeEventListener('offline', this.handleOffline.bind(this))
    }
  }
  
  /**
   * 设置WebSocket事件监听器
   */
  private setupEventListeners(): void {
    if (!this.ws) return
    
    this.ws.onopen = this.handleOpen.bind(this)
    this.ws.onclose = this.handleClose.bind(this)
    this.ws.onerror = this.handleWebSocketError.bind(this)
    this.ws.onmessage = this.handleMessage.bind(this)
  }
  
  /**
   * 处理连接打开
   */
  private handleOpen(event: Event): void {
    this.log('info', 'WebSocket connected')
    this.setConnectionState('connected')
    this.connectionInfo.connectedAt = Date.now()
    this.connectionInfo.disconnectedAt = undefined
    this.reconnectAttempts = 0
    this.isReconnecting = false
    
    // 启动心跳
    this.startHeartbeat()
    
    // 发送队列中的消息
    this.flushMessageQueue()
    
    // 触发事件
    this.events.onOpen?.(event)
  }
  
  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    this.log('info', `WebSocket closed: ${event.code} ${event.reason}`)
    this.setConnectionState('disconnected')
    this.connectionInfo.disconnectedAt = Date.now()
    this.stopHeartbeat()
    
    // 触发事件
    this.events.onClose?.(event)
    
    // 自动重连
    if (this.config.reconnect.enabled && !this.isDestroyed && event.code !== 1000) {
      this.scheduleReconnect()
    }
  }
  
  /**
   * 处理WebSocket错误
   */
  private handleWebSocketError(event: Event): void {
    this.log('error', 'WebSocket error', event)
    this.handleError('connection', 'WebSocket connection error', event)
    this.events.onError?.(event)
  }
  
  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      this.stats.messagesReceived++
      
      // 处理心跳响应
      if (message.type === 'pong') {
        this.handlePongMessage()
        return
      }
      
      // 处理确认消息
      if (message.ack && message.id) {
        this.handleAckMessage(message.id)
      }
      
      this.log('debug', 'Received message', message)
      this.events.onMessage?.(message)
    } catch (error) {
      this.log('error', 'Failed to parse message', error)
      this.handleError('message', 'Failed to parse received message', error)
    }
  }
  
  /**
   * 实际发送消息
   */
  private doSendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message)
      return
    }
    
    try {
      const messageStr = JSON.stringify(message)
      this.ws.send(messageStr)
      this.stats.messagesSent++
      
      // 如果需要确认，添加到待确认列表
      if (message.ack) {
        this.pendingMessages.set(message.id, {
          id: message.id,
          message,
          timestamp: Date.now(),
          retries: 0,
          maxRetries: 3,
        })
      }
      
      this.log('debug', 'Sent message', message)
    } catch (error) {
      this.log('error', 'Failed to send message', error)
      this.handleError('message', 'Failed to send message', error)
    }
  }
  
  /**
   * 将消息添加到队列
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      this.messageQueue.shift() // 移除最旧的消息
    }
    
    this.messageQueue.push({
      id: message.id,
      message,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    })
    
    this.log('debug', 'Message queued', message)
  }
  
  /**
   * 发送队列中的所有消息
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const queuedMessage = this.messageQueue.shift()
      if (queuedMessage) {
        this.doSendMessage(queuedMessage.message)
      }
    }
  }
  
  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeat.enabled) return
    
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeat.interval)
  }
  
  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }
  
  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    
    this.lastHeartbeatTime = Date.now()
    this.sendMessage({
      type: 'ping',
      data: this.config.heartbeat.pingMessage,
    })
    
    // 设置心跳超时
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.log('warn', 'Heartbeat timeout')
      this.handleError('heartbeat', 'Heartbeat timeout')
      this.ws?.close()
    }, this.config.heartbeat.timeout)
  }
  
  /**
   * 处理心跳响应
   */
  private handlePongMessage(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
    
    const latency = Date.now() - this.lastHeartbeatTime
    this.connectionInfo.latency = latency
    this.stats.lastHeartbeat = Date.now()
    
    // 更新平均延迟
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency
    } else {
      this.stats.averageLatency = (this.stats.averageLatency + latency) / 2
    }
    
    // 更新连接质量
    this.updateConnectionQuality(latency)
    
    this.log('debug', `Heartbeat latency: ${latency}ms`)
  }
  
  /**
   * 处理确认消息
   */
  private handleAckMessage(messageId: string): void {
    this.pendingMessages.delete(messageId)
  }
  
  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      this.log('error', 'Max reconnect attempts reached')
      this.events.onReconnectFailed?.(this.reconnectAttempts)
      return
    }
    
    this.isReconnecting = true
    this.setConnectionState('reconnecting')
    
    const delay = this.calculateReconnectDelay()
    this.log('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.stats.reconnectCount++
      this.events.onReconnect?.(this.reconnectAttempts)
      this.connect()
    }, delay)
  }
  
  /**
   * 计算重连延迟
   */
  private calculateReconnectDelay(): number {
    const { initialDelay, maxDelay, backoffFactor, jitter } = this.config.reconnect
    let delay = initialDelay * Math.pow(backoffFactor, this.reconnectAttempts)
    delay = Math.min(delay, maxDelay)
    
    if (jitter) {
      delay += Math.random() * 1000 // 添加0-1秒的随机抖动
    }
    
    return delay
  }
  
  /**
   * 设置连接状态
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state
      this.connectionInfo.connectionState = state
      this.connectionInfo.readyState = this.ws?.readyState ?? WebSocketReadyState.UNINSTANTIATED
      this.events.onConnectionStateChange?.(state)
    }
  }
  
  /**
   * 更新连接质量
   */
  private updateConnectionQuality(latency: number): void {
    let quality: WebSocketStats['connectionQuality']
    
    if (this.connectionState !== 'connected') {
      quality = 'disconnected'
    } else if (latency < 100) {
      quality = 'excellent'
    } else if (latency < 300) {
      quality = 'good'
    } else {
      quality = 'poor'
    }
    
    this.stats.connectionQuality = quality
  }
  
  /**
   * 处理错误
   */
  private handleError(type: WebSocketError['type'], message: string, details?: unknown): void {
    this.connectionInfo.lastError = message
    this.log('error', message, details)
  }
  
  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // 页面隐藏时暂停心跳
      this.stopHeartbeat()
    } else {
      // 页面显示时恢复心跳
      if (this.connectionState === 'connected') {
        this.startHeartbeat()
      }
    }
  }
  
  /**
   * 处理网络连接
   */
  private handleOnline(): void {
    this.log('info', 'Network online')
    if (this.connectionState === 'disconnected') {
      this.connect()
    }
  }
  
  /**
   * 处理网络断开
   */
  private handleOffline(): void {
    this.log('info', 'Network offline')
    this.disconnect()
  }
  
  /**
   * 清理定时器
   */
  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
  
  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    if (!this.config.enableLogging) return
    
    const timestamp = new Date().toISOString()
    const prefix = `[WebSocket ${timestamp}]`
    
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data)
        break
      case 'info':
        console.info(prefix, message, data)
        break
      case 'warn':
        console.warn(prefix, message, data)
        break
      case 'error':
        console.error(prefix, message, data)
        break
    }
  }
}

// 导出单例实例
let defaultClient: WebSocketClient | null = null

/**
 * 获取默认WebSocket客户端实例
 */
export function getDefaultWebSocketClient(config?: Partial<WebSocketConfig>): WebSocketClient {
  if (!defaultClient) {
    defaultClient = new WebSocketClient(config)
  }
  return defaultClient
}

/**
 * 销毁默认WebSocket客户端实例
 */
export function destroyDefaultWebSocketClient(): void {
  if (defaultClient) {
    defaultClient.destroy()
    defaultClient = null
  }
}