/**
 * 业务逻辑处理器主模块
 * 负责处理消息分类后的业务流程，执行自动回复、数据统计等功能
 */
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// 策略模式处理器导入
const AutoReplyStrategy = require('./strategies/AutoReplyStrategy');
const StatisticsStrategy = require('./strategies/StatisticsStrategy');
const CustomerBehaviorStrategy = require('./strategies/CustomerBehaviorStrategy');

class BusinessLogicProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 配置选项
    this.options = {
      enableLogging: options.enableLogging || true,
      dataPath: options.dataPath || path.join(__dirname, 'data'),
      autoReplyEnabled: options.autoReplyEnabled || false,
      statisticsEnabled: options.statisticsEnabled || true,
      customerBehaviorEnabled: options.customerBehaviorEnabled || true,
      ...options
    };
    
    // 确保数据目录存在
    if (!fs.existsSync(this.options.dataPath)) {
      fs.mkdirSync(this.options.dataPath, { recursive: true });
    }
    
    // 初始化策略处理器
    this.strategies = {
      autoReply: new AutoReplyStrategy(options.autoReplyOptions),
      statistics: new StatisticsStrategy(options.statisticsOptions),
      customerBehavior: new CustomerBehaviorStrategy(options.customerBehaviorOptions)
    };
    
    // 会话状态存储
    this.sessions = new Map();
    
    this.log('业务逻辑处理器初始化完成');
  }
  
  /**
   * 处理消息处理结果，执行业务逻辑
   * @param {Object} processedResult 消息处理结果
   * @returns {Object} 业务处理结果
   */
  process(processedResult) {
    if (!processedResult) {
      throw new Error('处理结果不能为空');
    }
    
    this.log('开始处理业务逻辑', processedResult);
    
    try {
      // 提取会话信息
      const clientId = processedResult.parsedMessage?.clientId || processedResult.originalMessage?.clientId;
      
      if (!clientId) {
        throw new Error('无法获取客户端ID');
      }
      
      // 获取会话上下文
      const sessionContext = this.getSessionContext(clientId);
      
      // 执行各策略处理器
      const results = {
        sessionId: clientId,
        timestamp: Date.now(),
        originalProcessedResult: processedResult
      };
      
      // 统计分析
      if (this.options.statisticsEnabled) {
        results.statistics = this.strategies.statistics.process(processedResult, sessionContext);
      }
      
      // 客户行为分析
      if (this.options.customerBehaviorEnabled) {
        results.behavior = this.strategies.customerBehavior.process(processedResult, sessionContext);
      }
      
      // 自动回复策略
      if (this.options.autoReplyEnabled) {
        results.autoReply = this.strategies.autoReply.process(processedResult, sessionContext);
      }
      
      // 更新会话上下文
      this.updateSessionContext(clientId, processedResult, results);
      
      // 触发业务处理完成事件
      this.emit('business_processed', results);
      
      return results;
    } catch (error) {
      this.log('业务逻辑处理出错', error, 'error');
      
      // 触发错误事件
      this.emit('error', error, processedResult);
      
      return {
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
      // 初始化新会话
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        history: [],
        customerInfo: {},
        statistics: {}
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.lastActivity = Date.now();
    
    return session;
  }
  
  /**
   * 更新会话上下文
   * @param {string} sessionId 会话ID
   * @param {Object} processedResult 消息处理结果
   * @param {Object} businessResults 业务处理结果
   */
  updateSessionContext(sessionId, processedResult, businessResults) {
    const session = this.getSessionContext(sessionId);
    
    // 更新消息计数
    session.messageCount++;
    
    // 添加消息历史
    if (processedResult.parsedMessage) {
      const historyEntry = {
        timestamp: processedResult.timestamp || Date.now(),
        message: processedResult.parsedMessage.cleanContent,
        intent: processedResult.bestIntent?.intent || 'unknown',
        autoReply: businessResults.autoReply?.message || null
      };
      
      // 保持历史记录在合理大小
      session.history.push(historyEntry);
      if (session.history.length > 20) {
        session.history.shift(); // 移除最旧的记录
      }
    }
    
    // 合并统计数据
    if (businessResults.statistics) {
      session.statistics = {
        ...session.statistics,
        ...businessResults.statistics
      };
    }
    
    // 合并客户信息
    if (businessResults.behavior && businessResults.behavior.customerInfo) {
      session.customerInfo = {
        ...session.customerInfo,
        ...businessResults.behavior.customerInfo
      };
    }
  }
  
  /**
   * 设置自动回复状态
   * @param {boolean} enabled 是否启用自动回复
   */
  setAutoReplyEnabled(enabled) {
    this.options.autoReplyEnabled = !!enabled;
    this.log(`自动回复已${enabled ? '启用' : '禁用'}`);
    return this.options.autoReplyEnabled;
  }
  
  /**
   * 获取所有会话信息
   * @returns {Array} 会话信息数组
   */
  getAllSessions() {
    const sessions = [];
    this.sessions.forEach(session => {
      sessions.push({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        customerInfo: session.customerInfo
      });
    });
    return sessions;
  }
  
  /**
   * 获取会话详情
   * @param {string} sessionId 会话ID
   * @returns {Object|null} 会话详情或null
   */
  getSessionDetail(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * 清理过期会话
   * @param {number} maxAge 最大会话年龄(ms)，默认2小时
   * @returns {number} 清理的会话数
   */
  cleanupSessions(maxAge = 7200000) {
    const now = Date.now();
    let count = 0;
    
    this.sessions.forEach((session, id) => {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(id);
        count++;
      }
    });
    
    this.log(`清理了 ${count} 个过期会话`);
    return count;
  }
  
  /**
   * 记录日志
   * @param {string} message 日志消息
   * @param {*} data 日志数据
   * @param {string} level 日志级别
   */
  log(message, data, level = 'info') {
    if (!this.options.enableLogging) return;
    
    const logMessage = `[BusinessLogic] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  }
}

module.exports = BusinessLogicProcessor; 