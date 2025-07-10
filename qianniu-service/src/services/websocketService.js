/**
 * WebSocket服务实现
 * 负责与千牛客户端进行实时通信
 */
const WebSocket = require('ws');
const config = require('../config');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // 存储客户端连接
    this.isRunning = false;
  }

  /**
   * 初始化WebSocket服务
   */
  init() {
    // 创建WebSocket服务器
    this.wss = new WebSocket.Server({ port: config.wsPort });
    
    // 监听连接事件
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // 监听错误事件
    this.wss.on('error', this.handleServerError.bind(this));
    
    this.isRunning = true;
    console.log(`WebSocket服务已启动，监听端口: ${config.wsPort}`);
    
    return this;
  }

  /**
   * 处理新的客户端连接
   * @param {WebSocket} ws WebSocket客户端连接
   * @param {Object} req HTTP请求对象
   */
  handleConnection(ws, req) {
    // 生成唯一客户端ID
    const clientId = this.generateClientId(req);
    
    console.log(`新客户端连接: ${clientId}`);
    
    // 存储客户端连接
    this.clients.set(clientId, {
      ws,
      ip: req.socket.remoteAddress,
      connectTime: new Date(),
      isAlive: true,
      info: {}
    });

    // 设置心跳检测
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // 处理消息事件
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // 处理关闭事件
    ws.on('close', () => {
      this.handleClose(clientId);
    });

    // 处理错误事件
    ws.on('error', (err) => {
      this.handleClientError(clientId, err);
    });

    // 发送欢迎消息
    this.sendToClient(clientId, {
      type: 'system',
      action: 'welcome',
      message: '连接成功',
      clientId
    });
  }

  /**
   * 处理客户端消息
   * @param {string} clientId 客户端ID
   * @param {Buffer|ArrayBuffer|Buffer[]} data 接收到的数据
   */
  handleMessage(clientId, data) {
    try {
      // 解析消息数据
      const message = JSON.parse(data.toString());
      console.log(`收到客户端[${clientId}]消息:`, message);

      // 根据消息类型处理
      switch(message.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
          
        case 'register':
          // 注册客户端信息
          if (this.clients.has(clientId)) {
            this.clients.get(clientId).info = message.data || {};
            this.sendToClient(clientId, { 
              type: 'system', 
              action: 'registered',
              success: true
            });
          }
          break;
          
        default:
          // 处理其他类型的消息
          // 这里可以添加消息路由逻辑
          console.log(`未处理的消息类型: ${message.type}`);
          
          // 记录接收到的消息
          this.onMessageReceived(clientId, message);
      }
    } catch (error) {
      console.error(`处理消息出错:`, error);
      
      // 发送错误响应
      this.sendToClient(clientId, {
        type: 'error',
        message: '消息格式错误',
        error: error.message
      });
    }
  }

  /**
   * 处理客户端关闭连接
   * @param {string} clientId 客户端ID
   */
  handleClose(clientId) {
    console.log(`客户端断开连接: ${clientId}`);
    
    // 移除客户端连接
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
    }
  }

  /**
   * 处理服务器错误
   * @param {Error} error 错误对象
   */
  handleServerError(error) {
    console.error('WebSocket服务器错误:', error);
  }

  /**
   * 处理客户端连接错误
   * @param {string} clientId 客户端ID
   * @param {Error} error 错误对象
   */
  handleClientError(clientId, error) {
    console.error(`客户端[${clientId}]连接错误:`, error);
    
    // 清理连接
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
    }
  }

  /**
   * 向指定客户端发送消息
   * @param {string} clientId 客户端ID
   * @param {Object} data 要发送的数据对象
   * @returns {boolean} 发送是否成功
   */
  sendToClient(clientId, data) {
    try {
      if (!this.clients.has(clientId)) {
        return false;
      }
      
      const client = this.clients.get(clientId);
      if (client.ws.readyState !== WebSocket.OPEN) {
        return false;
      }
      
      // 序列化数据并发送
      const message = JSON.stringify(data);
      client.ws.send(message);
      return true;
    } catch (error) {
      console.error(`发送消息到客户端[${clientId}]失败:`, error);
      return false;
    }
  }

  /**
   * 广播消息到所有连接的客户端
   * @param {Object} data 要广播的数据对象
   * @param {string|null} excludeClientId 要排除的客户端ID
   */
  broadcast(data, excludeClientId = null) {
    const message = JSON.stringify(data);
    
    this.clients.forEach((client, clientId) => {
      // 如果指定了排除的客户端，则跳过
      if (excludeClientId && clientId === excludeClientId) {
        return;
      }
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * 生成唯一的客户端ID
   * @param {Object} req HTTP请求对象
   * @returns {string} 客户端ID
   */
  generateClientId(req) {
    const ip = req.socket.remoteAddress || '0.0.0.0';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `client_${ip.replace(/[.:]/g, '_')}_${timestamp}_${random}`;
  }

  /**
   * 启动定期心跳检测
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.isAlive === false) {
          // 终止没有响应的连接
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }
        
        // 重置状态并发送ping
        client.ws.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30秒检测一次
  }

  /**
   * 停止WebSocket服务
   */
  stop() {
    if (this.isRunning) {
      // 清除心跳检测
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      // 关闭所有连接
      this.clients.forEach((client) => {
        client.ws.terminate();
      });
      
      // 清空客户端列表
      this.clients.clear();
      
      // 关闭服务器
      this.wss.close(() => {
        console.log('WebSocket服务已停止');
      });
      
      this.isRunning = false;
    }
  }

  /**
   * 消息接收回调
   * 该方法可被外部覆盖以处理接收到的消息
   * @param {string} clientId 客户端ID
   * @param {Object} message 消息对象
   */
  onMessageReceived(clientId, message) {
    // 默认实现，可被外部覆盖
    console.log(`收到消息，但未处理: ${clientId}`, message);
  }

  /**
   * 获取当前连接的客户端数量
   * @returns {number} 客户端数量
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 获取所有客户端信息
   * @returns {Array} 客户端信息数组
   */
  getClientsInfo() {
    const info = [];
    this.clients.forEach((client, clientId) => {
      info.push({
        id: clientId,
        ip: client.ip,
        connectTime: client.connectTime,
        info: client.info
      });
    });
    return info;
  }
}

// 导出单例
module.exports = new WebSocketService(); 