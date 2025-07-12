/**
 * 业务逻辑处理器主模块
 * 负责处理消息分类后的业务流程，执行自动回复、数据统计等功能
 */
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Logger from '../../utils/Logger.js';
import ErrorHandler from '../../utils/ErrorHandler.js';
import PerformanceMonitor from '../../utils/PerformanceMonitor.js';
import SessionManager from '../../utils/SessionManager.js';
import AutoReplyStrategy from './strategies/AutoReplyStrategy.js';
import StatisticsStrategy from './strategies/StatisticsStrategy.js';
import CustomerBehaviorStrategy from './strategies/CustomerBehaviorStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BusinessLogicProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    // 配置选项
    this.options = {
      enableLogging: this.configManager ? this.configManager.get('logging.enabled', true) : (options.enableLogging !== false),
      enablePerformanceMonitoring: this.configManager ? this.configManager.get('features.performanceMonitoring', true) : (options.enablePerformanceMonitoring !== false),
      enableSessionManagement: this.configManager ? this.configManager.get('features.sessionManagement', true) : (options.enableSessionManagement !== false),
      dataPath: this.configManager ? this.configManager.get('paths.data', path.join(__dirname, 'data')) : (options.dataPath || path.join(__dirname, 'data')),
      autoReplyEnabled: this.configManager ? this.configManager.get('features.autoReply', false) : (options.autoReplyEnabled || false),
      statisticsEnabled: this.configManager ? this.configManager.get('features.statistics', true) : (options.statisticsEnabled || true),
      customerBehaviorEnabled: this.configManager ? this.configManager.get('features.customerBehavior', true) : (options.customerBehaviorEnabled || true),
      sessionTimeout: this.configManager ? this.configManager.get('session.timeout', 30 * 60 * 1000) : (options.sessionTimeout || 30 * 60 * 1000), // 30分钟
      ...options
    };
    
    // 初始化统一工具类
    this.logger = options.logger || new Logger({
      module: 'BusinessLogicProcessor',
      level: this.configManager ? this.configManager.get('logging.level', 'info') : (options.logLevel || 'info'),
      enableConsole: this.configManager ? this.configManager.get('logging.enableConsole', true) : true,
      enableFile: this.configManager ? this.configManager.get('logging.enableFile', false) : false,
      configManager: this.configManager
    });
    
    this.errorHandler = options.errorHandler || new ErrorHandler({
      context: 'BusinessLogicProcessor',
      enableLogging: this.options.enableLogging,
      logLevel: this.configManager ? this.configManager.get('logging.level', 'info') : (options.logLevel || 'info'),
      configManager: this.configManager
    });
    
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor({
      enabled: this.options.enablePerformanceMonitoring,
      bufferSize: this.configManager ? this.configManager.get('performance.bufferSize', 1000) : (options.performanceBufferSize || 1000),
      configManager: this.configManager
    });
    
    this.sessionManager = options.sessionManager || new SessionManager({
      sessionTimeout: this.options.sessionTimeout,
      maxSessions: this.configManager ? this.configManager.get('session.maxSessions', 10000) : (options.maxSessions || 10000),
      enablePersistence: this.configManager ? this.configManager.get('session.enablePersistence', false) : (options.enableSessionPersistence || false),
      cleanupInterval: this.configManager ? this.configManager.get('session.cleanupInterval', 5 * 60 * 1000) : (5 * 60 * 1000),
      configManager: this.configManager
    });
    
    // 启动性能监控
    if (this.options.enablePerformanceMonitoring) {
      this.performanceMonitor.start();
    }
    
    // 确保数据目录存在
    if (!fs.existsSync(this.options.dataPath)) {
      fs.mkdirSync(this.options.dataPath, { recursive: true });
    }
    
    // 数据服务依赖注入
    this.dataService = options.dataService;
    if (!this.dataService) {
      throw new Error('BusinessLogicProcessor requires dataService dependency');
    }
    
    // 初始化策略处理器，传递工具类实例和数据服务
    const strategyOptions = {
      logger: this.logger,
      errorHandler: this.errorHandler,
      performanceMonitor: this.performanceMonitor,
      sessionManager: this.sessionManager,
      dataService: this.dataService
    };
    
    this.strategies = {
      autoReply: new AutoReplyStrategy({
        ...options.autoReplyOptions,
        ...strategyOptions
      }),
      statistics: new StatisticsStrategy({
        ...options.statisticsOptions,
        ...strategyOptions
      }),
      customerBehavior: new CustomerBehaviorStrategy({
        ...options.customerBehaviorOptions,
        ...strategyOptions
      })
    };
    
    // 保持向后兼容性：sessions属性指向SessionManager
    this.sessions = this.sessionManager;
    
    this.logger.info('业务逻辑处理器初始化完成', {
      enableLogging: this.options.enableLogging,
      enablePerformanceMonitoring: this.options.enablePerformanceMonitoring,
      enableSessionManagement: this.options.enableSessionManagement,
      strategiesCount: Object.keys(this.strategies).length
    });
  }
  
  /**
   * 处理消息处理结果，执行业务逻辑
   * @param {Object} processedResult 消息处理结果
   * @returns {Object} 业务处理结果
   */
  process(processedResult) {
    const timer = this.performanceMonitor?.startTimer('business_logic_process');
    
    try {
      if (!processedResult) {
        throw new Error('处理结果不能为空');
      }
      
      // 提取会话信息
      const clientId = processedResult.parsedMessage?.clientId || processedResult.originalMessage?.clientId;
      
      if (!clientId) {
        throw new Error('无法获取客户端ID');
      }
      
      this.logger.debug('开始处理业务逻辑', {
        clientId,
        intent: processedResult.bestIntent?.intent,
        messageLength: processedResult.parsedMessage?.cleanContent?.length
      });
      
      // 获取或创建会话上下文
      const sessionContext = this.getSessionContext(clientId);
      
      // 执行各策略处理器
      const results = {
        sessionId: clientId,
        timestamp: Date.now(),
        originalProcessedResult: processedResult
      };
      
      // 统计分析 - 添加独立性能监控
      if (this.options.statisticsEnabled) {
        const statsTimer = this.performanceMonitor?.startTimer('strategy_statistics');
        try {
          results.statistics = this.strategies.statistics.process(processedResult, sessionContext);
          this.logger.debug('统计分析策略执行完成', { clientId });
        } catch (error) {
          this.logger.error('统计分析策略执行失败', {
            error: error.message,
            clientId
          });
          if (this.errorHandler) {
            this.errorHandler.handle(error, { context: 'StatisticsStrategy.process', clientId });
          }
        } finally {
          statsTimer?.end();
        }
      }
      
      // 客户行为分析 - 添加独立性能监控
      if (this.options.customerBehaviorEnabled) {
        const behaviorTimer = this.performanceMonitor?.startTimer('strategy_customer_behavior');
        try {
          results.behavior = this.strategies.customerBehavior.process(processedResult, sessionContext);
          this.logger.debug('客户行为分析策略执行完成', { clientId });
        } catch (error) {
          this.logger.error('客户行为分析策略执行失败', {
            error: error.message,
            clientId
          });
          if (this.errorHandler) {
            this.errorHandler.handle(error, { context: 'CustomerBehaviorStrategy.process', clientId });
          }
        } finally {
          behaviorTimer?.end();
        }
      }
      
      // 自动回复策略 - 添加独立性能监控
      if (this.options.autoReplyEnabled) {
        const replyTimer = this.performanceMonitor?.startTimer('strategy_auto_reply');
        try {
          results.autoReply = this.strategies.autoReply.process(processedResult, sessionContext);
          this.logger.debug('自动回复策略执行完成', { 
            clientId,
            hasReply: !!results.autoReply?.message
          });
        } catch (error) {
          this.logger.error('自动回复策略执行失败', {
            error: error.message,
            clientId
          });
          if (this.errorHandler) {
            this.errorHandler.handle(error, { context: 'AutoReplyStrategy.process', clientId });
          }
        } finally {
          replyTimer?.end();
        }
      }
      
      // 更新会话上下文到SessionManager
      this.updateSessionContext(clientId, processedResult, results);
      
      this.logger.info('业务逻辑处理完成', {
        clientId,
        strategiesExecuted: {
          statistics: this.options.statisticsEnabled,
          behavior: this.options.customerBehaviorEnabled,
          autoReply: this.options.autoReplyEnabled
        },
        hasAutoReply: !!results.autoReply?.message
      });
      
      // 触发业务处理完成事件
      this.emit('business_processed', results);
      
      return results;
    } catch (error) {
      this.logger.error('业务逻辑处理出错', {
        error: error.message,
        stack: error.stack,
        clientId: processedResult?.parsedMessage?.clientId || processedResult?.originalMessage?.clientId
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { 
          context: 'BusinessLogicProcessor.process',
          processedResult 
        });
      }
      
      // 触发错误事件
      this.emit('error', error, processedResult);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 获取会话上下文
   * @param {string} clientId 客户端ID
   * @returns {Object} 会话上下文
   */
  getSessionContext(clientId) {
    const timer = this.performanceMonitor?.startTimer('get_session_context');
    
    try {
      if (!clientId) {
        throw new Error('客户端ID不能为空');
      }
      
      let session = this.sessionManager.getSession(clientId);
      
      if (!session) {
        this.logger.debug('创建新会话上下文', { clientId });
        session = this.sessionManager.createSession(clientId, 'business', {
          id: clientId,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 0,
          history: [],
          customerInfo: {},
          statistics: {}
        });
      } else {
        this.logger.debug('获取现有会话上下文', { 
          clientId,
          messageCount: session.data.messageCount || 0,
          lastActivity: new Date(session.data.lastActivity || session.lastAccessAt).toISOString()
        });
      }
      
      return session.data || session;
    } catch (error) {
      this.logger.error('获取会话上下文失败', {
        error: error.message,
        clientId
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'BusinessLogicProcessor.getSessionContext', clientId });
      }
      
      // 返回默认会话上下文
      return {
        id: clientId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        history: [],
        customerInfo: {},
        statistics: {}
      };
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 更新会话上下文
   * @param {string} clientId 客户端ID
   * @param {Object} processedResult 处理结果
   * @param {Object} businessResults 业务处理结果
   */
  updateSessionContext(clientId, processedResult, businessResults) {
    const timer = this.performanceMonitor?.startTimer('update_session_context');
    
    try {
      if (!clientId) {
        throw new Error('客户端ID不能为空');
      }
      
      const sessionObj = this.sessionManager.getSession(clientId);
      if (!sessionObj) {
        this.logger.warn('尝试更新不存在的会话', { clientId });
        return;
      }
      
      const session = sessionObj.data;
      
      // 更新基本信息
      session.lastActivity = Date.now();
      session.messageCount = (session.messageCount || 0) + 1;
      
      // 添加到历史记录
      session.history = session.history || [];
      const historyEntry = {
        timestamp: Date.now(),
        message: processedResult.parsedMessage,
        intent: processedResult.bestIntent,
        businessResults
      };
      
      session.history.push(historyEntry);
      
      // 限制历史记录长度
      const maxHistoryLength = 100;
      if (session.history.length > maxHistoryLength) {
        session.history = session.history.slice(-maxHistoryLength);
        this.logger.debug('历史记录已截断', { 
          clientId,
          maxLength: maxHistoryLength
        });
      }
      
      // 更新客户信息
      if (businessResults.behavior?.customerProfile) {
        session.customerInfo = {
          ...session.customerInfo,
          ...businessResults.behavior.customerProfile,
          lastUpdated: Date.now()
        };
        
        this.logger.debug('客户信息已更新', {
          clientId,
          profileKeys: Object.keys(businessResults.behavior.customerProfile)
        });
      }
      
      // 更新统计信息
      if (businessResults.statistics) {
        session.statistics = {
          ...session.statistics,
          ...businessResults.statistics,
          lastUpdated: Date.now()
        };
        
        this.logger.debug('统计信息已更新', {
          clientId,
          statisticsKeys: Object.keys(businessResults.statistics)
        });
      }
      
      // 使用SessionManager更新会话
      this.sessionManager.updateSession(clientId, {
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        history: session.history,
        customerInfo: session.customerInfo,
        statistics: session.statistics
      });
      
      this.logger.debug('会话上下文更新完成', {
        clientId,
        messageCount: session.messageCount,
        historyLength: session.history.length
      });
      
    } catch (error) {
      this.logger.error('更新会话上下文失败', {
        error: error.message,
        stack: error.stack,
        clientId
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { 
          context: 'BusinessLogicProcessor.updateSessionContext',
          clientId,
          processedResult,
          businessResults
        });
      }
    } finally {
      timer?.end();
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
   * @returns {Array} 会话列表
   */
  getAllSessions() {
    const timer = this.performanceMonitor?.startTimer('get_all_sessions');
    
    try {
      const sessions = this.sessionManager.getAllSessions();
      
      const sessionList = sessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.data.lastActivity || session.lastAccessAt,
        messageCount: session.data.messageCount || 0,
        hasCustomerInfo: Object.keys(session.data.customerInfo || {}).length > 0,
        hasStatistics: Object.keys(session.data.statistics || {}).length > 0,
        historyLength: (session.data.history || []).length
      }));
      
      this.logger.debug('获取所有会话信息', {
        totalSessions: sessionList.length,
        activeSessions: sessionList.filter(s => Date.now() - s.lastActivity < 60 * 60 * 1000).length
      });
      
      return sessionList;
    } catch (error) {
      this.logger.error('获取所有会话信息失败', {
        error: error.message
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'BusinessLogicProcessor.getAllSessions' });
      }
      
      return [];
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 获取会话详情
   * @param {string} sessionId 会话ID
   * @returns {Object|null} 会话详情或null
   */
  getSessionDetail(sessionId) {
    const timer = this.performanceMonitor?.startTimer('get_session_detail');
    
    try {
      if (!sessionId) {
        throw new Error('会话ID不能为空');
      }
      
      const session = this.sessionManager.getSession(sessionId);
      
      if (!session) {
        this.logger.warn('会话不存在', { sessionId });
        return null;
      }
      
      this.logger.debug('获取会话详情', {
        sessionId,
        messageCount: session.data.messageCount || 0,
        lastActivity: new Date(session.data.lastActivity || session.lastAccessAt).toISOString()
      });
      
      return session;
    } catch (error) {
      this.logger.error('获取会话详情失败', {
        error: error.message,
        sessionId
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'BusinessLogicProcessor.getSessionDetail', sessionId });
      }
      
      return null;
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 清理过期会话
   * @param {number} maxAge 最大会话年龄(ms)，默认2小时
   * @returns {number} 清理的会话数
   */
  cleanupSessions(maxAge = 7200000) {
    const timer = this.performanceMonitor?.startTimer('cleanup_sessions');
    
    try {
      const now = Date.now();
      const allSessions = this.sessionManager.getAllSessions();
      const expiredSessionIds = [];
      
      for (const session of allSessions) {
        const lastActivity = session.data.lastActivity || session.lastAccessAt.getTime();
        if (now - lastActivity > maxAge) {
          expiredSessionIds.push(session.id);
        }
      }
      
      // 删除过期会话
      let cleanedCount = 0;
      for (const sessionId of expiredSessionIds) {
        try {
          this.sessionManager.deleteSession(sessionId);
          cleanedCount++;
          const expiredSession = allSessions.find(s => s.id === sessionId);
          const lastActivity = expiredSession?.data?.lastActivity || expiredSession?.lastAccessAt?.getTime();
          this.logger.debug('清理过期会话', {
            sessionId,
            lastActivity: lastActivity ? new Date(lastActivity).toISOString() : 'unknown'
          });
        } catch (error) {
          this.logger.error('清理会话失败', {
            error: error.message,
            sessionId
          });
        }
      }
      
      this.logger.info('会话清理完成', {
        totalSessions: allSessions.length,
        expiredSessions: expiredSessionIds.length,
        cleanedSessions: cleanedCount,
        maxAgeHours: maxAge / (60 * 60 * 1000)
      });
      
      return cleanedCount;
    } catch (error) {
      this.logger.error('清理会话过程失败', {
        error: error.message,
        stack: error.stack
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'BusinessLogicProcessor.cleanupSessions', maxAge });
      }
      
      return 0;
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 日志记录 - 兼容性方法
   * @param {string} message 日志消息
   * @param {*} data 日志数据
   * @param {string} level 日志级别
   */
  log(message, data = null, level = 'info') {
    try {
      const logData = {
        service: 'BusinessLogicProcessor',
        message,
        data
      };
      
      // 使用统一的Logger工具类
      if (this.logger) {
        switch (level) {
          case 'error':
            this.logger.error(message, logData);
            break;
          case 'warn':
            this.logger.warn(message, logData);
            break;
          case 'debug':
            this.logger.debug(message, logData);
            break;
          default:
            this.logger.info(message, logData);
        }
      } else {
        // 降级到控制台输出
        const fullLogData = {
          timestamp: new Date().toISOString(),
          ...logData
        };
        
        if (level === 'error') {
          console.error(JSON.stringify(fullLogData));
        } else {
          console.log(JSON.stringify(fullLogData));
        }
      }
    } catch (error) {
      // 确保日志记录不会导致系统崩溃
      console.error('日志记录失败:', error.message, { originalMessage: message, originalData: data });
    }
  }
}

export default BusinessLogicProcessor;