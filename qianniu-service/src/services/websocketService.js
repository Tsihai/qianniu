/**
 * WebSocket 服务
 * 处理客户端连接、消息收发和心跳检测
 */
const WebSocket = require('ws');
const EventEmitter = require('events');
const MessageProcessor = require('./messageProcessor');

class WebSocketService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 8080,
      path: options.path || '/ws',
      heartbeatInterval: options.heartbeatInterval || 30000,
      enableProcessing: options.enableProcessing !== false, // 默认启用消息处理
      ...options
    };

    this.clients = new Map();
    this.server = null;
    
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
  }

  /**
   * 启动WebSocket服务
   */
  start() {
    // 创建WebSocket服务器
    const wss = new WebSocket.Server({
      port: this.options.port,
      path: this.options.path
    });

    this.server = wss;
    console.log(`WebSocket服务已启动: ws://localhost:${this.options.port}${this.options.path}`);

    // 注册事件处理程序
    this.registerEventHandlers();
    
    // 启动心跳检测
    this.startHeartbeat();
    
    return this.server;
  }

  /**
   * 注册事件处理程序
   */
  registerEventHandlers() {
    // 处理新客户端连接
    this.server.on('connection', (ws, req) => {
      const clientId = this.generateClientId(req);
      
      // 存储客户端信息
      this.clients.set(clientId, {
        ws,
        id: clientId,
        ip: req.socket.remoteAddress,
        connectTime: Date.now(),
        lastActivity: Date.now(),
        isAlive: true
      });

      // 设置心跳检测
      ws.isAlive = true;
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastActivity = Date.now();
        }
      });

      // 处理接收到的消息
      ws.on('message', (message) => {
        this.handleMessage(message, clientId);
      });

      // 处理连接关闭
      ws.on('close', () => {
        this.handleClose(clientId);
      });

      // 处理错误
      ws.on('error', (error) => {
        this.handleError(error, clientId);
      });

      // 发送欢迎消息
      this.sendTo(clientId, {
        type: 'system',
        content: '连接成功',
        timestamp: Date.now()
      });

      // 触发连接事件
      this.emit('connection', clientId, req);
      console.log(`客户端已连接: ${clientId}`);
    });

    // 处理服务器错误
    this.server.on('error', (error) => {
      console.error('WebSocket服务器错误:', error);
      this.emit('server_error', error);
    });
  }

  /**
   * 处理接收到的消息
   * @param {Buffer|String} data 接收到的数据
   * @param {string} clientId 客户端ID
   */
  handleMessage(data, clientId) {
    try {
      // 更新客户端活动时间
      const client = this.clients.get(clientId);
      if (client) {
        client.lastActivity = Date.now();
      }

      // 解析消息
      const message = this.parseMessage(data);

      // 添加客户端ID和时间戳
      message.clientId = clientId;
      if (!message.timestamp) {
        message.timestamp = Date.now();
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
        const processedResult = this.messageProcessor.processMessage(message);
        
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
      
    } catch (error) {
      console.error('处理消息出错:', error);
      this.emit('message_error', error, data, clientId);
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
    console.log(`收到来自 ${clientId} 的聊天消息:`, message.content);
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
      
      // 回复心跳
      this.sendTo(clientId, {
        type: 'heartbeat',
        timestamp: Date.now()
      });
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
  }

  /**
   * 检查所有连接
   */
  checkConnections() {
    for (const [clientId, client] of this.clients.entries()) {
      if (!client.isAlive) {
        // 如果客户端没有响应上一次的心跳检测，断开连接
        console.log(`客户端 ${clientId} 心跳超时，断开连接`);
        client.ws.terminate();
        this.clients.delete(clientId);
        this.emit('disconnection', clientId, 'heartbeat_timeout');
        continue;
      }

      // 重置心跳状态，发送ping
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (error) {
        console.error(`向客户端 ${clientId} 发送ping失败:`, error);
        client.ws.terminate();
        this.clients.delete(clientId);
        this.emit('disconnection', clientId, 'ping_error');
      }
    }
  }

  /**
   * 向指定客户端发送消息
   * @param {string} clientId 客户端ID
   * @param {Object|string} message 消息内容
   * @returns {boolean} 是否发送成功
   */
  sendTo(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`客户端 ${clientId} 不存在，无法发送消息`);
      return false;
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      client.ws.send(messageStr);
      return true;
    } catch (error) {
      console.error(`向客户端 ${clientId} 发送消息失败:`, error);
      this.emit('send_error', error, clientId, message);
      return false;
    }
  }

  /**
   * 广播消息给所有客户端
   * @param {Object|string} message 消息内容
   * @param {Array<string>} exclude 排除的客户端ID列表
   * @returns {number} 成功发送的客户端数量
   */
  broadcast(message, exclude = []) {
    let successCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      // 跳过被排除的客户端
      if (exclude.includes(clientId)) {
        continue;
      }

      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        client.ws.send(messageStr);
        successCount++;
      } catch (error) {
        console.error(`向客户端 ${clientId} 广播消息失败:`, error);
      }
    }

    return successCount;
  }

  /**
   * 停止WebSocket服务
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.server) {
      // 关闭所有连接
      for (const [clientId, client] of this.clients.entries()) {
        try {
          client.ws.terminate();
        } catch (error) {
          console.error(`关闭客户端 ${clientId} 连接出错:`, error);
        }
      }

      // 清空客户端列表
      this.clients.clear();

      // 关闭服务器
      this.server.close(() => {
        console.log('WebSocket服务已停止');
        this.emit('stopped');
      });
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

module.exports = WebSocketService; 