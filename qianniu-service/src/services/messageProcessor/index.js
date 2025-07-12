/**
 * 消息处理器主模块
 * 整合消息解析、意图识别和回复推荐功能
 */
import MessageParser from './MessageParser.js';
import IntentClassifier from './IntentClassifier.js';
import ReplyRecommender from './ReplyRecommender.js';
import { EventEmitter } from 'events';

// 引入统一工具类
import ErrorHandler from '../../utils/ErrorHandler.js';
import Logger from '../../utils/Logger.js';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor.js';
import SessionManager from '../../utils/SessionManager.js';

class MessageProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    // 配置选项
    this.options = {
      enableLogging: this.configManager ? this.configManager.get('logging.enabled', true) : (options.enableLogging !== false),
      enablePerformanceMonitoring: this.configManager ? this.configManager.get('features.performanceMonitoring', true) : (options.enablePerformanceMonitoring !== false),
      enableSessionManagement: this.configManager ? this.configManager.get('features.sessionManagement', true) : (options.enableSessionManagement !== false),
      logLevel: this.configManager ? this.configManager.get('logging.level', 'info') : (options.logLevel || 'info'),
      maxIntentsPerMessage: this.configManager ? this.configManager.get('processing.maxIntentsPerMessage', 3) : (options.maxIntentsPerMessage || 3),
      confidenceThreshold: this.configManager ? this.configManager.get('processing.confidenceThreshold', 0.5) : (options.confidenceThreshold || 0.5),
      sessionTimeout: this.configManager ? this.configManager.get('session.timeout', 30 * 60 * 1000) : (options.sessionTimeout || 30 * 60 * 1000), // 30分钟
      maxSessionHistory: this.configManager ? this.configManager.get('session.maxHistory', 20) : (options.maxSessionHistory || 20),
      ...options
    };
    
    // 初始化工具类
    this.errorHandler = new ErrorHandler({
      context: 'MessageProcessor',
      enableLogging: this.options.enableLogging,
      logLevel: this.options.logLevel,
      configManager: this.configManager
    });
    
    this.logger = new Logger({
      context: 'MessageProcessor',
      level: this.options.logLevel,
      enableConsole: this.configManager ? this.configManager.get('logging.enableConsole', true) : true,
      enableFile: this.configManager ? this.configManager.get('logging.enableFile', false) : false,
      configManager: this.configManager
    });
    
    this.performanceMonitor = new PerformanceMonitor({
      context: 'MessageProcessor',
      enabled: this.options.enablePerformanceMonitoring,
      configManager: this.configManager
    });
    
    this.sessionManager = new SessionManager({
      defaultTTL: this.options.sessionTimeout,
      cleanupInterval: this.configManager ? this.configManager.get('session.cleanupInterval', 5 * 60 * 1000) : (5 * 60 * 1000),
      maxHistorySize: this.options.maxSessionHistory,
      configManager: this.configManager
    });
    
    // 初始化各子模块
    this.parser = new MessageParser({
      errorHandler: this.errorHandler,
      logger: this.logger,
      performanceMonitor: this.performanceMonitor
    });
    
    this.classifier = new IntentClassifier({
      errorHandler: this.errorHandler,
      logger: this.logger,
      performanceMonitor: this.performanceMonitor,
      confidenceThreshold: this.options.confidenceThreshold
    });
    
    this.recommender = new ReplyRecommender({
      errorHandler: this.errorHandler,
      logger: this.logger,
      performanceMonitor: this.performanceMonitor
    });
    
    // 移除旧的会话存储，使用统一的SessionManager
    // 保存会话状态（向后兼容）
    this.sessions = this.sessionManager.sessions;
    
    // 启动性能监控
    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor.start();
    }
    
    // 启动会话清理
    if (this.options.enableSessionManagement) {
      this.sessionManager.startCleanup();
    }
    
    this.logger.info('消息处理器初始化完成', {
      enableLogging: this.options.enableLogging,
      enablePerformanceMonitoring: this.options.enablePerformanceMonitoring,
      enableSessionManagement: this.options.enableSessionManagement
    });
  }

  /**
   * 处理单条消息
   * @param {Object} message 原始消息对象
   * @returns {Object} 处理结果
   */
  processMessage(message) {
    const startTime = Date.now();
    const messageId = message?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 输入验证
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid message format');
      }
      
      this.logger.info('开始处理消息', { messageId, messageType: message.type });
      
      // 记录性能指标
      this.performanceMonitor.recordCustomMetric('messages_received', 1);
      this.performanceMonitor.recordCustomMetric('message_size', JSON.stringify(message).length);
      
      // 1. 解析消息
      const parseStartTime = Date.now();
      const parsedMessage = this.parser.parse(message);
      this.performanceMonitor.recordCustomMetric('parse_time', Date.now() - parseStartTime);
      this.logger.debug('解析消息完成', { messageId, parsedContent: parsedMessage.content });
      
      // 2. 分类识别意图
      const classifyStartTime = Date.now();
      const intents = this.classifier.classify(parsedMessage);
      this.performanceMonitor.recordCustomMetric('classify_time', Date.now() - classifyStartTime);
      this.performanceMonitor.recordCustomMetric('intents_found', intents.length);
      this.logger.debug('意图识别完成', { messageId, intentsCount: intents.length });
      
      // 3. 获取会话上下文
      const sessionId = parsedMessage.clientId;
      const context = this.getSessionContext(sessionId);
      
      // 4. 生成回复建议
      const replyStartTime = Date.now();
      const replies = this.recommender.generateMultipleReplies(
        parsedMessage,
        intents,
        context,
        this.options.maxIntentsPerMessage
      );
      this.performanceMonitor.recordCustomMetric('reply_generation_time', Date.now() - replyStartTime);
      this.performanceMonitor.recordCustomMetric('replies_generated', replies.length);
      this.logger.debug('生成回复建议完成', { messageId, repliesCount: replies.length });
      
      // 5. 更新会话状态
      this.updateSessionContext(sessionId, parsedMessage, intents, replies);
      
      // 6. 构建处理结果
      const result = {
        messageId,
        originalMessage: message,
        parsedMessage,
        intents,
        bestIntent: intents.length > 0 ? intents[0] : null,
        replies,
        bestReply: replies.length > 0 ? replies[0] : null,
        context,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
      
      // 记录总处理时间
      this.performanceMonitor.recordCustomMetric('total_processing_time', result.processingTime);
      this.performanceMonitor.recordCustomMetric('messages_processed_success', 1);
      
      this.logger.info('消息处理完成', {
        messageId,
        processingTime: result.processingTime,
        intentsCount: intents.length,
        repliesCount: replies.length
      });
      
      // 触发消息处理完成事件
      this.emit('message_processed', result);
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // 使用统一错误处理
      const handledError = this.errorHandler.handleError(error, {
        context: 'processMessage',
        messageId,
        message,
        processingTime
      });
      
      // 记录错误指标
      this.performanceMonitor.recordCustomMetric('messages_processed_error', 1);
      this.performanceMonitor.recordCustomMetric('error_processing_time', processingTime);
      
      this.logger.error('处理消息出错', {
        messageId,
        error: handledError.message,
        processingTime,
        stack: handledError.stack
      });
      
      // 触发错误事件
      this.emit('error', handledError, message);
      
      // 返回错误结果
      return {
        messageId,
        originalMessage: message,
        error: handledError.message,
        errorCode: handledError.code,
        processingTime,
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
    try {
      // 使用统一的SessionManager
      const session = this.sessionManager.getSession(sessionId);
      
      this.logger.debug('获取会话上下文', {
        sessionId,
        messageCount: session.messageCount,
        lastActivity: session.lastActivityTime
      });
      
      return session;
    } catch (error) {
      const handledError = this.errorHandler.handleError(error, {
        context: 'getSessionContext',
        sessionId
      });
      
      this.logger.error('获取会话上下文失败', {
        sessionId,
        error: handledError.message
      });
      
      // 返回默认会话
      return this.sessionManager.createSession(sessionId);
    }
  }
  
  /**
   * 更新会话上下文
   * @param {string} sessionId 会话ID
   * @param {Object} parsedMessage 解析后的消息
   * @param {Array} intents 识别出的意图
   * @param {Array} replies 生成的回复
   */
  updateSessionContext(sessionId, parsedMessage, intents, replies) {
    try {
      // 构建会话数据
      const sessionData = {
        content: parsedMessage.content,
        intents: intents.map(intent => intent.intent),
        keywords: parsedMessage.keywords,
        replies: replies.map(reply => reply.content || reply),
        timestamp: Date.now()
      };
      
      // 使用统一的SessionManager更新会话
      this.sessionManager.updateSession(sessionId, sessionData);
      
      // 记录性能指标
      this.performanceMonitor.recordCustomMetric('session_updates', 1);
      
      this.logger.debug('更新会话上下文完成', {
        sessionId,
        intentsCount: intents.length,
        repliesCount: replies.length
      });
      
    } catch (error) {
      const handledError = this.errorHandler.handleError(error, {
        context: 'updateSessionContext',
        sessionId,
        parsedMessage,
        intents,
        replies
      });
      
      this.logger.error('更新会话上下文失败', {
        sessionId,
        error: handledError.message
      });
    }
  }
  
  /**
   * 清理过期会话
   * @param {number} maxInactiveTime 最大不活跃时间(毫秒)
   */
  cleanupSessions(maxInactiveTime = 30 * 60 * 1000) {
    try {
      const cleanupResult = this.sessionManager.cleanup(maxInactiveTime);
      
      this.performanceMonitor.recordCustomMetric('sessions_cleaned', cleanupResult.cleaned);
      this.performanceMonitor.recordCustomMetric('active_sessions', cleanupResult.remaining);
      
      this.logger.info('会话清理完成', {
        cleaned: cleanupResult.cleaned,
        remaining: cleanupResult.remaining,
        maxInactiveTime
      });
      
      return cleanupResult;
    } catch (error) {
      const handledError = this.errorHandler.handleError(error, {
        context: 'cleanupSessions',
        maxInactiveTime
      });
      
      this.logger.error('会话清理失败', {
        error: handledError.message,
        maxInactiveTime
      });
      
      return { cleaned: 0, remaining: this.sessions.size };
    }
  }
  
  /**
   * 获取性能统计信息
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    try {
      const stats = this.performanceMonitor.getStats();
      const sessionStats = this.sessionManager.getStats();
      
      return {
        ...stats,
        sessions: sessionStats,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('获取性能统计失败', { error: error.message });
      return { error: '无法获取性能统计' };
    }
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

export default MessageProcessor;