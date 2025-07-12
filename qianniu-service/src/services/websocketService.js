/**
 * WebSocket 服务
 * 处理客户端连接、消息收发和心跳检测
 * 集成统一错误处理、日志记录、性能监控和会话管理
 */
import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import MessageProcessor from './messageProcessor/index.js';
import ErrorHandler from '../utils/ErrorHandler.js';
import Logger from '../utils/Logger.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import SessionManager from '../utils/SessionManager.js';

class WebSocketService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    // 临时调试：检查configManager
    console.log('WebSocketService构造函数 - configManager:', this.configManager);
    console.log('WebSocketService构造函数 - options:', Object.keys(options));
    
    this.options = {
      port: this.configManager ? this.configManager.get('websocket.port', 8080) : (options.port || 8080),
      path: this.configManager ? this.configManager.get('websocket.path', '/ws') : (options.path || '/ws'),
      heartbeatInterval: this.configManager ? this.configManager.get('websocket.heartbeatInterval', 30000) : (options.heartbeatInterval || 30000),
      enableProcessing: this.configManager ? this.configManager.get('websocket.enableProcessing', true) : (options.enableProcessing !== false),
      enablePerformanceMonitoring: this.configManager ? this.configManager.get('features.performanceMonitoring', true) : (options.enablePerformanceMonitoring !== false),
      enableSessionManagement: this.configManager ? this.configManager.get('websocket.enableSessionManagement', true) : (options.enableSessionManagement !== false),
      maxConnections: this.configManager ? this.configManager.get('websocket.maxConnections', 1000) : (options.maxConnections || 1000),
      messageRateLimit: this.configManager ? this.configManager.get('websocket.messageRateLimit', 100) : (options.messageRateLimit || 100),
      ...options
    };

    this.clients = new Map();
    this.server = null;
    
    // 初始化工具类
    this.errorHandler = new ErrorHandler({
      context: 'WebSocketService',
      enableLogging: this.configManager ? this.configManager.get('logging.enabled', true) : true,
      logLevel: this.configManager ? this.configManager.get('logging.level', 'error') : (options.logLevel || 'error'),
      configManager: this.configManager
    });
    
    this.logger = new Logger({
      context: 'WebSocketService',
      level: this.configManager ? this.configManager.get('logging.level', 'info') : (options.logLevel || 'info'),
      enableConsole: this.configManager ? this.configManager.get('logging.enableConsole', true) : true,
      enableFile: this.configManager ? this.configManager.get('logging.enableFile', false) : false,
      configManager: this.configManager
    });
    
    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor({
        enabled: true,
        context: 'WebSocketService',
        configManager: this.configManager
      });
    }
    
    if (this.options.enableSessionManagement) {
      this.sessionManager = new SessionManager({
        defaultTTL: this.configManager ? this.configManager.get('websocket.sessionTTL', 3600000) : (options.sessionTTL || 3600000),
        cleanupInterval: this.configManager ? this.configManager.get('websocket.sessionCleanupInterval', 300000) : (options.sessionCleanupInterval || 300000),
        configManager: this.configManager
      });
    }
    
    // 消息速率限制
    this.messageRateLimiter = new Map();
    
    // 创建消息处理器实例
    if (this.options.enableProcessing) {
      this.messageProcessor = new MessageProcessor(options.processorOptions);
      
      // 转发消息处理器事件
      this.messageProcessor.on('message_processed', (result) => {
        this.emit('message_processed', result);
      });
      
      this.messageProcessor.on('error', (error, message) => {
        this.emit('processor_error', error, message);
      });
    }
    
    // 启动性能监控
    if (this.options.enablePerformanceMonitoring && this.performanceMonitor) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * 启动WebSocket服务
   */
  start() {
    try {
      const startTime = Date.now();
      
      // 创建WebSocket服务器
      const wss = new WebSocketServer({
        port: this.options.port,
        path: this.options.path,
        maxPayload: this.options.maxPayload || 16 * 1024 * 1024, // 16MB
        perMessageDeflate: {
          threshold: 1024,
          concurrencyLimit: 10
        }
      });

      this.server = wss;
      
      // 记录启动性能
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCustomMetric('server_start_time', Date.now() - startTime);
        this.performanceMonitor.recordCounter('server_starts');
      }
      
      this.logger.info('WebSocket服务启动中', {
        port: this.options.port,
        path: this.options.path,
        maxConnections: this.options.maxConnections
      });

      // 注册事件处理程序
      this.registerEventHandlers();
      
      // 启动心跳检测
      this.startHeartbeat();
      
      // 启动性能监控
      if (this.performanceMonitor) {
        this.startPerformanceMonitoring();
      }
      
      this.logger.info('WebSocket服务已启动', {
        address: `ws://localhost:${this.options.port}${this.options.path}`,
        startupTime: Date.now() - startTime
      });
      
      return this.server;
    } catch (error) {
      // 临时调试：输出原始错误信息
      console.error('WebSocketService启动原始错误:', error);
      console.error('错误堆栈:', error.stack);
      
      const handledError = this.errorHandler.handle(error, {
        operation: 'start_websocket_service',
        port: this.options.port
      });
      throw handledError;
    }
  }

  /**
   * 注册事件处理程序
   */
  registerEventHandlers() {
    // 处理新客户端连接
    this.server.on('connection', (ws, req) => {
      try {
        // 检查连接数限制
        if (this.clients.size >= this.options.maxConnections) {
          this.logger.warn('连接数已达上限，拒绝新连接', {
            currentConnections: this.clients.size,
            maxConnections: this.options.maxConnections,
            clientIP: req.socket.remoteAddress
          });
          ws.close(1013, '服务器繁忙，请稍后重试');
          return;
        }
        
        const clientId = this.generateClientId(req);
        const clientIP = this.getClientIP(req);
        
        // 输入验证
        if (!this.validateConnection(req)) {
          this.logger.warn('连接验证失败', { clientIP, userAgent: req.headers['user-agent'] });
          ws.close(1002, '连接验证失败');
          return;
        }
        
        // 存储客户端信息
        const clientInfo = {
          ws,
          id: clientId,
          ip: clientIP,
          connectTime: Date.now(),
          lastActivity: Date.now(),
          isAlive: true,
          messageCount: 0,
          lastMessageTime: 0
        };
        
        this.clients.set(clientId, clientInfo);
        
        // 创建会话
        if (this.sessionManager) {
          this.sessionManager.createSession(clientId, {
            clientIP,
            userAgent: req.headers['user-agent'],
            connectTime: Date.now()
          });
        }
        
        // 记录性能指标
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCounter('connections_total');
          this.performanceMonitor.recordGauge('active_connections', this.clients.size);
        }

        // 设置心跳检测
        ws.isAlive = true;
        ws.on('pong', () => {
          const client = this.clients.get(clientId);
          if (client) {
            client.isAlive = true;
            client.lastActivity = Date.now();
            
            // 更新会话活动时间
            if (this.sessionManager) {
              this.sessionManager.updateActivity(clientId);
            }
          }
        });

        // 处理接收到的消息
        ws.on('message', (message) => {
          this.handleMessage(message, clientId);
        });

        // 处理连接关闭
        ws.on('close', (code, reason) => {
          this.handleClose(clientId, code, reason);
        });

        // 处理错误
        ws.on('error', (error) => {
          this.handleError(error, clientId);
        });

        // 发送欢迎消息
        this.sendTo(clientId, {
          type: 'system',
          content: '连接成功',
          clientId,
          timestamp: Date.now()
        });

        // 触发连接事件
        this.emit('connection', clientId, req);
        
        this.logger.info('客户端连接成功', {
          clientId,
          clientIP,
          totalConnections: this.clients.size,
          userAgent: req.headers['user-agent']
        });
        
      } catch (error) {
        const handledError = this.errorHandler.handle(error, {
          operation: 'handle_new_connection',
          clientIP: req.socket.remoteAddress
        });
        
        try {
          ws.close(1011, '服务器内部错误');
        } catch (closeError) {
          this.logger.error('关闭错误连接失败', { error: closeError });
        }
      }
    });

    // 处理服务器错误
    this.server.on('error', (error) => {
      const handledError = this.errorHandler.handle(error, {
        operation: 'websocket_server_error'
      });
      this.emit('server_error', handledError);
    });
  }

  /**
   * 处理接收到的消息
   * @param {Buffer|String} data 接收到的数据
   * @param {string} clientId 客户端ID
   */
  handleMessage(data, clientId) {
    const startTime = Date.now();
    
    try {
      // 获取客户端信息
      const client = this.clients.get(clientId);
      if (!client) {
        this.logger.warn('收到来自未知客户端的消息', { clientId });
        return;
      }
      
      // 消息速率限制检查
      if (!this.checkMessageRateLimit(clientId)) {
        this.logger.warn('客户端消息频率过高', {
          clientId,
          messageCount: client.messageCount,
          rateLimit: this.options.messageRateLimit
        });
        
        this.sendTo(clientId, {
          type: 'error',
          content: '消息发送频率过高，请稍后重试',
          timestamp: Date.now()
        });
        return;
      }
      
      // 输入验证
      if (!this.validateMessage(data)) {
        this.logger.warn('收到无效消息', { clientId, dataLength: data.length });
        
        this.sendTo(clientId, {
          type: 'error',
          content: '消息格式无效',
          timestamp: Date.now()
        });
        return;
      }

      // 更新客户端活动时间和消息计数
      client.lastActivity = Date.now();
      client.messageCount++;
      client.lastMessageTime = Date.now();
      
      // 更新会话活动
      if (this.sessionManager) {
        this.sessionManager.updateActivity(clientId);
      }

      // 解析消息
      const message = this.parseMessage(data);

      // 添加客户端ID和时间戳
      message.clientId = clientId;
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }
      
      // 记录消息处理性能
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCounter('messages_received');
        this.performanceMonitor.recordGauge('message_size', data.length);
      }

      // 根据消息类型处理
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(clientId);
          break;
        case 'chat':
          this.handleChatMessage(message, clientId);
          break;
        default:
          // 处理其他类型的消息
          this.emit('message', message, clientId);
      }
      
      // 使用消息处理器处理消息（如果启用）
      if (this.options.enableProcessing && this.messageProcessor) {
        const processingStartTime = Date.now();
        const processedResult = this.messageProcessor.processMessage(message);
        
        // 记录消息处理时间
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCustomMetric('message_processing_time', Date.now() - processingStartTime);
        }
        
        // 如果有自动回复功能，可以在此处添加代码
        if (this.options.autoReply && processedResult.bestReply) {
          this.sendTo(clientId, {
            type: 'chat',
            content: processedResult.bestReply.text,
            isAutoReply: true,
            replyTo: message.id || null,
            timestamp: Date.now()
          });
        }
      }
      
      // 记录总处理时间
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCustomMetric('message_handle_time', Date.now() - startTime);
      }
      
      this.logger.debug('消息处理完成', {
        clientId,
        messageType: message.type,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      const handledError = this.errorHandler.handle(error, {
        operation: 'handle_message',
        clientId,
        dataLength: data ? data.length : 0
      });
      
      this.emit('message_error', handledError, data, clientId);
      
      // 发送错误响应给客户端
      this.sendTo(clientId, {
        type: 'error',
        content: '消息处理失败',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理聊天消息
   * @param {Object} message 聊天消息
   * @param {string} clientId 客户端ID
   */
  handleChatMessage(message, clientId) {
    // 触发聊天消息事件
    this.emit('chat', message, clientId);
    // 同时触发通用消息事件，保持API一致性
    this.emit('message', message, clientId);
    console.log(`收到来自 ${clientId} 的聊天消息:`, message.content);
  }

  /**
   * 检查消息速率限制
   * @param {string} clientId 客户端ID
   * @returns {boolean} 是否通过速率限制检查
   */
  checkMessageRateLimit(clientId) {
    if (!this.options.messageRateLimit) {
      return true;
    }
    
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    const now = Date.now();
    const timeWindow = 60000; // 1分钟窗口
    
    // 初始化消息计数器
    if (!client.messageCount) {
      client.messageCount = 0;
      client.messageCountResetTime = now;
    }
    
    // 重置计数器（如果超过时间窗口）
    if (now - client.messageCountResetTime > timeWindow) {
      client.messageCount = 0;
      client.messageCountResetTime = now;
    }
    
    return client.messageCount < this.options.messageRateLimit;
  }
  
  /**
   * 验证消息格式
   * @param {Buffer|String} data 消息数据
   * @returns {boolean} 是否为有效消息
   */
  validateMessage(data) {
    try {
      // 检查数据是否存在
      if (!data) {
        return false;
      }
      
      // 检查数据长度
      const maxMessageSize = this.options.maxMessageSize || 1024 * 1024; // 默认1MB
      if (data.length > maxMessageSize) {
        return false;
      }
      
      // 尝试解析JSON
      const message = this.parseMessage(data);
      
      // 检查必需字段
      if (!message.type) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证连接
   * @param {Object} req 请求对象
   * @returns {boolean} 是否为有效连接
   */
  validateConnection(req) {
    try {
      // 检查User-Agent
      const userAgent = req.headers['user-agent'];
      if (!userAgent || userAgent.length > 500) {
        return false;
      }
      
      // 检查Origin（如果配置了允许的源）
      if (this.options.allowedOrigins) {
        const origin = req.headers.origin;
        if (!origin || !this.options.allowedOrigins.includes(origin)) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取客户端IP
   * @param {Object} req 请求对象
   * @returns {string} 客户端IP地址
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    if (!this.performanceMonitor) {
      return;
    }
    
    // 定期记录连接数
    this.performanceInterval = setInterval(() => {
      this.performanceMonitor.recordGauge('active_connections', this.clients.size);
      
      // 记录内存使用情况
      const memUsage = process.memoryUsage();
      this.performanceMonitor.recordGauge('memory_usage_mb', memUsage.heapUsed / 1024 / 1024);
      
    }, 30000); // 每30秒记录一次
  }

  /**
   * 处理心跳消息
   * @param {string} clientId 客户端ID
   */
  handleHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastActivity = Date.now();
      
      // 记录心跳性能指标
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCounter('heartbeats_received');
      }
      
      // 回复心跳
      this.sendTo(clientId, {
        type: 'heartbeat',
        timestamp: Date.now()
      });
      
      this.logger.debug('处理心跳消息', { clientId });
    }
  }

  /**
   * 处理连接关闭
   * @param {string} clientId 客户端ID
   */
  handleClose(clientId) {
    // 移除客户端
    this.clients.delete(clientId);
    this.emit('disconnection', clientId);
    console.log(`客户端已断开连接: ${clientId}`);
  }

  /**
   * 处理连接错误
   * @param {Error} error 错误对象
   * @param {string} clientId 客户端ID
   */
  handleError(error, clientId) {
    console.error(`客户端 ${clientId} 连接错误:`, error);
    this.emit('client_error', error, clientId);
  }

  /**
   * 解析接收到的消息
   * @param {Buffer|String} data 接收到的数据
   * @returns {Object} 解析后的消息对象
   */
  parseMessage(data) {
    const messageStr = data.toString();
    try {
      return JSON.parse(messageStr);
    } catch (error) {
      // 如果不是JSON格式，作为纯文本处理
      return {
        type: 'chat',
        content: messageStr
      };
    }
  }

  /**
   * 生成客户端ID
   * @param {Object} req 请求对象
   * @returns {string} 客户端ID
   */
  generateClientId(req) {
    const ip = req.socket.remoteAddress || 'unknown';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `client_${ip.replace(/[.:]/g, '_')}_${timestamp}_${random}`;
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.checkConnections();
    }, this.options.heartbeatInterval);
    
    this.logger.info('心跳检测已启动', {
      interval: this.options.heartbeatInterval,
      timeout: this.options.heartbeatTimeout
    });
  }

  /**
   * 检查所有连接
   */
  checkConnections() {
    const disconnectedClients = [];
    
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (!client.isAlive) {
          // 如果客户端没有响应上一次的心跳检测，断开连接
          this.logger.warn('客户端心跳超时', {
            clientId,
            lastActivity: new Date(client.lastActivity).toISOString(),
            connectTime: new Date(client.connectTime).toISOString()
          });
          
          // 记录超时事件
          if (this.performanceMonitor) {
            this.performanceMonitor.recordCounter('heartbeat_timeouts');
          }
          
          // 清理会话
          if (this.sessionManager) {
            this.sessionManager.removeSession(clientId);
          }
          
          client.ws.terminate();
          disconnectedClients.push(clientId);
          this.emit('disconnection', clientId, 'heartbeat_timeout');
          continue;
        }

        // 重置心跳状态，发送ping
        client.isAlive = false;
        client.ws.ping();
        
        // 记录心跳发送
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCounter('heartbeat_pings_sent');
        }
        
      } catch (error) {
        const handledError = this.errorHandler.handle(error, {
          operation: 'check_connection',
          clientId
        });
        
        this.logger.error('心跳检测失败', {
          clientId,
          error: handledError.message
        });
        
        // 如果检查连接时出错，也将其标记为断开
        client.ws.terminate();
        disconnectedClients.push(clientId);
        this.emit('disconnection', clientId, 'ping_error');
      }
    }
    
    // 批量删除断开的客户端
    disconnectedClients.forEach(clientId => {
      this.clients.delete(clientId);
    });
    
    // 更新连接数指标
    if (this.performanceMonitor) {
      this.performanceMonitor.recordGauge('active_connections', this.clients.size);
    }
    
    if (disconnectedClients.length > 0) {
      this.logger.info('清理超时连接', {
        disconnectedCount: disconnectedClients.length,
        activeConnections: this.clients.size
      });
    }
  }

  /**
   * 向指定客户端发送消息
   * @param {string} clientId 客户端ID
   * @param {Object|string} message 消息内容
   * @returns {boolean} 是否发送成功
   */
  sendTo(clientId, message) {
    const startTime = Date.now();
    
    try {
      const client = this.clients.get(clientId);
      if (!client) {
        this.logger.warn('尝试向不存在的客户端发送消息', { clientId });
        return false;
      }
      
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.logger.warn('客户端连接未就绪', {
          clientId,
          readyState: client.ws.readyState
        });
        return false;
      }
      
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      client.ws.send(messageStr);
      
      // 记录发送性能指标
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCounter('messages_sent');
        this.performanceMonitor.recordGauge('message_send_size', messageStr.length);
        this.performanceMonitor.recordCustomMetric('message_send_time', Date.now() - startTime);
      }
      
      this.logger.debug('消息发送成功', {
        clientId,
        messageType: message?.type,
        messageSize: messageStr.length
      });
      
      return true;
      
    } catch (error) {
      const handledError = this.errorHandler.handle(error, {
        operation: 'send_message',
        clientId,
        messageType: message?.type
      });
      
      this.emit('send_error', handledError, clientId, message);
      return false;
    }
  }

  /**
   * 广播消息给所有客户端
   * @param {Object|string} message 消息内容
   * @param {Array<string>} exclude 排除的客户端ID列表
   * @returns {Object} 广播结果统计
   */
  broadcast(message, exclude = []) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      for (const [clientId, client] of this.clients.entries()) {
        // 跳过被排除的客户端
        if (exclude.includes(clientId)) {
          continue;
        }
        
        if (client.ws.readyState !== WebSocket.OPEN) {
          failureCount++;
          continue;
        }

        try {
          client.ws.send(messageStr);
          successCount++;
        } catch (error) {
          failureCount++;
          
          const handledError = this.errorHandler.handle(error, {
            operation: 'broadcast_message',
            clientId,
            messageType: message?.type
          });
          
          this.emit('broadcast_error', handledError, clientId, message);
        }
      }
      
      // 记录广播性能指标
      if (this.performanceMonitor) {
        this.performanceMonitor.recordCounter('messages_broadcast');
        this.performanceMonitor.recordGauge('broadcast_success_count', successCount);
        this.performanceMonitor.recordGauge('broadcast_failure_count', failureCount);
        this.performanceMonitor.recordCustomMetric('broadcast_time', Date.now() - startTime);
      }
      
      this.logger.info('消息广播完成', {
        messageType: message?.type,
        totalClients: this.clients.size,
        successCount,
        failureCount,
        excludeCount: exclude.length,
        broadcastTime: Date.now() - startTime
      });
      
      return { successCount, failureCount };
      
    } catch (error) {
      const handledError = this.errorHandler.handle(error, {
        operation: 'broadcast_message',
        messageType: message?.type
      });
      
      this.logger.error('广播消息失败', {
        error: handledError.message,
        messageType: message?.type
      });
      
      return { successCount: 0, failureCount: this.clients.size };
    }
  }

  /**
   * 停止WebSocket服务
   */
  async stop() {
    this.logger.info('开始停止WebSocket服务');
    
    try {
      // 清除心跳检测
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        this.logger.debug('心跳检测已停止');
      }
      
      // 清除性能监控
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
        this.performanceInterval = null;
        this.logger.debug('性能监控已停止');
      }

      if (this.server) {
        // 关闭所有客户端连接
        const closePromises = [];
        for (const [clientId, client] of this.clients.entries()) {
          try {
            // 发送关闭通知
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify({
                type: 'server_shutdown',
                message: '服务器正在关闭',
                timestamp: Date.now()
              }));
            }
            
            // 清理会话
            if (this.sessionManager) {
              this.sessionManager.removeSession(clientId);
            }
            
            const closePromise = new Promise((resolve) => {
              client.ws.close(1000, '服务器关闭');
              setTimeout(resolve, 100); // 给客户端一些时间处理关闭
            });
            
            closePromises.push(closePromise);
            
          } catch (error) {
            this.errorHandler.handle(error, {
              operation: 'close_client_connection',
              clientId
            });
          }
        }
        
        // 等待所有连接关闭
        await Promise.all(closePromises);
        this.logger.info('所有客户端连接已关闭', { clientCount: this.clients.size });

        // 清空客户端列表
        this.clients.clear();
        
        // 记录最终性能指标
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCounter('server_stops');
          this.performanceMonitor.recordGauge('active_connections', 0);
        }

        // 关闭服务器
        return new Promise((resolve) => {
          this.server.close(() => {
            this.logger.info('WebSocket服务已完全停止');
            this.emit('stopped');
            resolve();
          });
        });
      }
      
    } catch (error) {
      const handledError = this.errorHandler.handle(error, {
        operation: 'stop_websocket_service'
      });
      
      this.logger.error('停止WebSocket服务时发生错误', {
        error: handledError.message
      });
      
      throw handledError;
    }
  }

  /**
   * 获取当前连接的客户端数量
   * @returns {number} 客户端数量
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 获取客户端列表
   * @returns {Array} 客户端信息列表
   */
  getClientList() {
    const clientList = [];
    for (const [clientId, client] of this.clients.entries()) {
      clientList.push({
        id: clientId,
        ip: client.ip,
        connectTime: client.connectTime,
        lastActivity: client.lastActivity
      });
    }
    return clientList;
  }
  
  /**
   * 处理特定类型的消息
   * @param {Object} message 消息对象
   * @param {Function} handler 处理函数
   */
  processMessage(message, handler) {
    if (this.options.enableProcessing && this.messageProcessor) {
      const processedResult = this.messageProcessor.processMessage(message);
      
      if (handler && typeof handler === 'function') {
        handler(processedResult);
      }
      
      return processedResult;
    }
    
    return null;
  }
  
  /**
   * 获取消息处理器实例
   * @returns {MessageProcessor|null} 消息处理器实例
   */
  getMessageProcessor() {
    return this.messageProcessor;
  }
}

export default WebSocketService;