/**
 * 消息处理器主模块
 * 整合消息解析、意图识别和回复推荐功能
 */
const MessageParser = require('./MessageParser');
const IntentClassifier = require('./IntentClassifier');
const ReplyRecommender = require('./ReplyRecommender');
const EventEmitter = require('events');

class MessageProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 初始化各子模块
    this.parser = new MessageParser();
    this.classifier = new IntentClassifier();
    this.recommender = new ReplyRecommender();
    
    // 保存会话状态
    this.sessions = new Map();
    
    // 配置选项
    this.options = {
      enableLogging: options.enableLogging || true,
      maxIntentsPerMessage: options.maxIntentsPerMessage || 3,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      ...options
    };
    
    console.log('消息处理器初始化完成');
  }

  /**
   * 处理单条消息
   * @param {Object} message 原始消息对象
   * @returns {Object} 处理结果
   */
  processMessage(message) {
    try {
      // 1. 解析消息
      const parsedMessage = this.parser.parse(message);
      this.log('解析消息完成', parsedMessage);
      
      // 2. 分类识别意图
      const intents = this.classifier.classify(parsedMessage);
      this.log('意图识别完成', intents);
      
      // 3. 获取会话上下文
      const sessionId = parsedMessage.clientId;
      const context = this.getSessionContext(sessionId);
      
      // 4. 生成回复建议
      const replies = this.recommender.generateMultipleReplies(
        parsedMessage,
        intents,
        context,
        this.options.maxIntentsPerMessage
      );
      this.log('生成回复建议完成', replies);
      
      // 5. 更新会话状态
      this.updateSessionContext(sessionId, parsedMessage, intents, replies);
      
      // 6. 构建处理结果
      const result = {
        originalMessage: message,
        parsedMessage,
        intents,
        bestIntent: intents.length > 0 ? intents[0] : null,
        replies,
        bestReply: replies.length > 0 ? replies[0] : null,
        context,
        timestamp: Date.now()
      };
      
      // 触发消息处理完成事件
      this.emit('message_processed', result);
      
      return result;
    } catch (error) {
      this.log('处理消息出错', error, 'error');
      
      // 触发错误事件
      this.emit('error', error, message);
      
      // 返回错误结果
      return {
        originalMessage: message,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 获取会话上下文
   * @param {string} sessionId 会话ID
   * @returns {Object} 会话上下文
   */
  getSessionContext(sessionId) {
    if (!this.sessions.has(sessionId)) {
      // 创建新会话
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        lastActivityTime: Date.now(),
        messageCount: 0,
        history: [],
        data: {}
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.lastActivityTime = Date.now();
    
    return session;
  }
  
  /**
   * 更新会话上下文
   * @param {string} sessionId 会话ID
   * @param {Object} parsedMessage 解析后的消息
   * @param {Array} intents 识别出的意图
   * @param {Array} replies 生成的回复
   */
  updateSessionContext(sessionId, parsedMessage, intents, replies) {
    const session = this.getSessionContext(sessionId);
    
    // 更新消息计数
    session.messageCount++;
    
    // 添加到历史记录
    session.history.push({
      timestamp: Date.now(),
      content: parsedMessage.content,
      intents: intents.map(intent => intent.intent),
      keywords: parsedMessage.keywords
    });
    
    // 限制历史记录长度
    if (session.history.length > 20) {
      session.history.shift();
    }
    
    // 保存最后一次意图
    if (intents.length > 0) {
      session.data.lastIntent = intents[0].intent;
    }
    
    // 保存最后一次关键词
    session.data.lastKeywords = parsedMessage.keywords;
    
    this.sessions.set(sessionId, session);
  }
  
  /**
   * 清理过期会话
   * @param {number} maxInactiveTime 最大不活跃时间(毫秒)
   */
  cleanupSessions(maxInactiveTime = 30 * 60 * 1000) {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityTime > maxInactiveTime) {
        this.sessions.delete(sessionId);
        this.log(`清理过期会话: ${sessionId}`);
      }
    }
  }
  
  /**
   * 记录日志
   * @param {string} message 日志消息
   * @param {*} data 日志数据
   * @param {string} level 日志级别
   */
  log(message, data = null, level = 'info') {
    if (!this.options.enableLogging) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      level
    };
    
    if (data) {
      if (data instanceof Error) {
        logEntry.error = {
          message: data.message,
          stack: data.stack
        };
      } else {
        logEntry.data = data;
      }
    }
    
    switch (level) {
      case 'error':
        console.error(`[MessageProcessor] ${message}`, data);
        break;
      case 'warn':
        console.warn(`[MessageProcessor] ${message}`, data);
        break;
      default:
        console.log(`[MessageProcessor] ${message}`, data);
    }
    
    // 触发日志事件
    this.emit('log', logEntry);
  }
  
  /**
   * 创建一个独立的消息处理上下文
   * @param {string} sessionId 会话ID
   * @returns {Object} 处理上下文
   */
  createContext(sessionId) {
    return {
      sessionId,
      processor: this,
      parser: this.parser,
      classifier: this.classifier,
      recommender: this.recommender,
      session: this.getSessionContext(sessionId)
    };
  }
}

module.exports = MessageProcessor; 