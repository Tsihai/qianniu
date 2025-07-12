/**
 * 统计分析策略处理器
 * 负责对消息和会话进行统计和分析
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StatisticsStrategy {
  constructor(options = {}) {
    // 集成统一工具类
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    this.performanceMonitor = options.performanceMonitor;
    this.sessionManager = options.sessionManager;
    
    // 数据服务依赖注入
    this.dataService = options.dataService;
    if (!this.dataService) {
      throw new Error('StatisticsStrategy requires dataService dependency');
    }
    
    // 配置选项
    this.options = {
      saveInterval: options?.saveInterval || 3600000, // 1小时保存一次
      dataPath: options?.dataPath || path.join(__dirname, '../data/statistics.json'),
      intentsToTrack: options?.intentsToTrack || ['greeting', 'farewell', 'price_inquiry', 'shipping', 'product_inquiry', 'complaint', 'unknown'],
      ...options
    };
    
    // 统计数据存储
    this.statistics = {
      messageCount: 0,                // 消息总数
      sessionCount: 0,                // 会话总数
      intentDistribution: {},         // 意图分布
      hourlyMessageCount: Array(24).fill(0),  // 每小时消息数
      dailyMessageCount: {},          // 每天消息数
      avgMessagesPerSession: 0,       // 平均每会话消息数
      topKeywords: [],                // 热门关键词
      lastUpdated: Date.now()         // 最后更新时间
    };
    
    // 当前会话统计数据
    this.sessionStatistics = new Map();
    
    // 加载历史统计数据
    this.loadStatistics();
    
    // 设置定时保存
    if (this.options.saveInterval > 0) {
      this.saveIntervalId = setInterval(() => {
        try {
          this.saveStatistics();
        } catch (error) {
          this.logger.error('定时保存统计数据失败', {
            error: error.message,
            interval: this.options.saveInterval
          });
          
          if (this.errorHandler) {
            this.errorHandler.handle(error, { context: 'StatisticsStrategy.autoSave' });
          }
        }
      }, this.options.saveInterval);
    }
    
    this.logger.info('统计分析策略处理器初始化完成', {
      saveInterval: this.options.saveInterval,
      dataPath: this.options.dataPath,
      intentsToTrack: this.options.intentsToTrack.length
    });
  }
  
  /**
   * 加载统计数据
   */
  async loadStatistics() {
    const timer = this.performanceMonitor?.startTimer('statistics_load');
    
    try {
      // 从数据服务获取统计数据
      const statisticsData = await this.dataService.getStatistics();
      
      if (statisticsData && statisticsData.length > 0) {
        // 使用最新的统计记录
        const latestStats = statisticsData[0];
        this.statistics = {
          messageCount: latestStats.messageCount || 0,
          sessionCount: latestStats.sessionCount || 0,
          intentDistribution: latestStats.intentDistribution || {},
          hourlyMessageCount: latestStats.hourlyMessageCount || Array(24).fill(0),
          dailyMessageCount: latestStats.dailyMessageCount || {},
          avgMessagesPerSession: latestStats.avgMessagesPerSession || 0,
          topKeywords: latestStats.topKeywords || [],
          lastUpdated: latestStats.lastUpdated || Date.now()
        };
        
        this.logger.info('统计数据加载成功', {
          source: 'dataService',
          messageCount: this.statistics.messageCount,
          sessionCount: this.statistics.sessionCount
        });
      } else {
        this.logger.info('统计数据不存在，使用默认配置', {
          source: 'dataService'
        });
      }
    } catch (error) {
      const errorMsg = '加载统计数据失败';
      this.logger.error(errorMsg, { error: error.message });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'StatisticsStrategy.loadStatistics' });
      }
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 保存统计数据
   */
  async saveStatistics() {
    const timer = this.performanceMonitor?.startTimer('statistics_save');
    
    try {
      // 准备统计数据
      const statisticsData = {
        messageCount: this.statistics.messageCount,
        sessionCount: this.statistics.sessionCount,
        intentDistribution: this.statistics.intentDistribution,
        hourlyMessageCount: this.statistics.hourlyMessageCount,
        dailyMessageCount: this.statistics.dailyMessageCount,
        avgMessagesPerSession: this.statistics.avgMessagesPerSession,
        topKeywords: this.statistics.topKeywords,
        lastUpdated: Date.now()
      };
      
      // 保存到数据服务
      await this.dataService.saveStatistics(statisticsData);
      
      this.logger.info('统计数据保存成功', {
        source: 'dataService',
        messageCount: this.statistics.messageCount,
        sessionCount: this.statistics.sessionCount
      });
      
      return true;
    } catch (error) {
      const errorMsg = '保存统计数据失败';
      this.logger.error(errorMsg, { error: error.message });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'StatisticsStrategy.saveStatistics' });
      }
      
      return false;
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 处理消息，更新统计数据
   * @param {Object} processedResult 消息处理结果
   * @param {Object} sessionContext 会话上下文
   * @returns {Object} 处理结果
   */
  process(processedResult, sessionContext) {
    const timer = this.performanceMonitor?.startTimer('statistics_process');
    
    if (!processedResult) {
      const error = new Error('无效的消息处理结果');
      this.logger.error('统计处理失败：无效输入', { processedResult, sessionContext });
      timer?.end();
      return { error: error.message };
    }
    
    try {
      // 提取必要信息
      const sessionId = sessionContext.id;
      const timestamp = processedResult.timestamp || Date.now();
      const intents = processedResult.intents || [];
      const bestIntent = intents.length > 0 ? intents[0].intent : 'unknown';
      const keywords = processedResult.parsedMessage?.keywords || [];
      
      this.logger.debug('开始处理统计数据', {
        sessionId,
        intent: bestIntent,
        keywordsCount: keywords.length,
        timestamp
      });
      
      // 更新全局统计数据
      this.updateGlobalStatistics(bestIntent, timestamp, keywords);
      
      // 更新会话统计数据
      this.updateSessionStatistics(sessionId, bestIntent, timestamp, keywords);
      
      // 构建返回结果
      const result = {
        messageCount: this.statistics.messageCount,
        sessionCount: this.statistics.sessionCount,
        sessionMessagesCount: sessionContext.messageCount,
        intent: bestIntent,
        intentConfidence: intents.length > 0 ? intents[0].confidence : 0,
        timestamp
      };
      
      this.logger.debug('统计处理完成', {
        messageCount: result.messageCount,
        sessionCount: result.sessionCount,
        intent: result.intent
      });
      
      return result;
    } catch (error) {
      const errorMsg = '统计处理出错';
      this.logger.error(errorMsg, {
        error: error.message,
        stack: error.stack,
        sessionId: sessionContext?.id,
        processedResult: processedResult
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          context: 'StatisticsStrategy.process',
          sessionContext,
          processedResult
        });
      }
      
      return { error: error.message };
    } finally {
      timer?.end();
    }
  }
  
  /**
   * 更新全局统计数据
   * @param {string} intent 意图
   * @param {number} timestamp 时间戳
   * @param {Array} keywords 关键词
   */
  updateGlobalStatistics(intent, timestamp, keywords) {
    // 增加消息计数
    this.statistics.messageCount++;
    
    // 更新意图分布
    if (!this.statistics.intentDistribution[intent]) {
      this.statistics.intentDistribution[intent] = 0;
    }
    this.statistics.intentDistribution[intent]++;
    
    // 更新每小时消息数
    const hour = new Date(timestamp).getHours();
    this.statistics.hourlyMessageCount[hour]++;
    
    // 更新每天消息数
    const dateStr = new Date(timestamp).toISOString().split('T')[0];
    if (!this.statistics.dailyMessageCount[dateStr]) {
      this.statistics.dailyMessageCount[dateStr] = 0;
    }
    this.statistics.dailyMessageCount[dateStr]++;
    
    // 更新热门关键词
    this.updateTopKeywords(keywords);
    
    // 更新平均每会话消息数
    if (this.statistics.sessionCount > 0) {
      this.statistics.avgMessagesPerSession = 
        this.statistics.messageCount / this.statistics.sessionCount;
    }
  }
  
  /**
   * 更新会话统计数据
   * @param {string} sessionId 会话ID
   * @param {string} intent 意图
   * @param {number} timestamp 时间戳
   * @param {Array} keywords 关键词
   */
  updateSessionStatistics(sessionId, intent, timestamp, keywords) {
    // 如果是新会话
    if (!this.sessionStatistics.has(sessionId)) {
      this.statistics.sessionCount++;
      this.sessionStatistics.set(sessionId, {
        startTime: timestamp,
        messageCount: 0,
        intents: {},
        keywords: new Map(),
        lastActivity: timestamp
      });
    }
    
    const sessionStats = this.sessionStatistics.get(sessionId);
    
    // 更新会话消息计数
    sessionStats.messageCount++;
    
    // 更新会话意图分布
    if (!sessionStats.intents[intent]) {
      sessionStats.intents[intent] = 0;
    }
    sessionStats.intents[intent]++;
    
    // 更新会话关键词
    keywords.forEach(keyword => {
      const count = sessionStats.keywords.get(keyword) || 0;
      sessionStats.keywords.set(keyword, count + 1);
    });
    
    // 更新最后活动时间
    sessionStats.lastActivity = timestamp;
    
    // 更新会话持续时间
    sessionStats.duration = timestamp - sessionStats.startTime;
  }
  
  /**
   * 更新热门关键词统计
   * @param {Array} keywords 关键词列表
   */
  updateTopKeywords(keywords) {
    // 初始化热门关键词统计
    if (!Array.isArray(this.statistics.topKeywords)) {
      this.statistics.topKeywords = [];
    }
    
    // 更新关键词统计
    keywords.forEach(keyword => {
      const existing = this.statistics.topKeywords.find(k => k.word === keyword);
      if (existing) {
        existing.count++;
      } else {
        this.statistics.topKeywords.push({
          word: keyword,
          count: 1
        });
      }
    });
    
    // 按出现频率排序
    this.statistics.topKeywords.sort((a, b) => b.count - a.count);
    
    // 只保留前100个关键词
    if (this.statistics.topKeywords.length > 100) {
      this.statistics.topKeywords = this.statistics.topKeywords.slice(0, 100);
    }
  }
  
  /**
   * 获取统计数据
   * @param {string} type 统计类型: 'global', 'daily', 'hourly', 'intent', 'keywords'
   * @param {Object} options 可选参数
   * @returns {Object} 统计数据
   */
  getStatistics(type = 'global', options = {}) {
    switch (type) {
      case 'global':
        return {
          messageCount: this.statistics.messageCount,
          sessionCount: this.statistics.sessionCount,
          avgMessagesPerSession: this.statistics.avgMessagesPerSession,
          lastUpdated: this.statistics.lastUpdated
        };
        
      case 'daily':
        return {
          dailyMessageCount: this.statistics.dailyMessageCount
        };
        
      case 'hourly':
        return {
          hourlyMessageCount: this.statistics.hourlyMessageCount
        };
        
      case 'intent':
        return {
          intentDistribution: this.statistics.intentDistribution
        };
        
      case 'keywords':
        const count = options.count || 20;
        return {
          topKeywords: this.statistics.topKeywords.slice(0, count)
        };
        
      case 'all':
        return { ...this.statistics };
        
      default:
        return { error: '未知的统计类型' };
    }
  }
  
  /**
   * 获取指定会话的统计数据
   * @param {string} sessionId 会话ID
   * @returns {Object|null} 会话统计数据或null
   */
  getSessionStatistics(sessionId) {
    const sessionStats = this.sessionStatistics.get(sessionId);
    if (!sessionStats) return null;
    
    // 转换关键词Map为数组
    const keywords = [];
    sessionStats.keywords.forEach((count, word) => {
      keywords.push({ word, count });
    });
    keywords.sort((a, b) => b.count - a.count);
    
    return {
      ...sessionStats,
      keywords
    };
  }
  
  /**
   * 重置统计数据
   * @param {boolean} keepSessions 是否保留会话统计
   */
  resetStatistics(keepSessions = false) {
    this.statistics = {
      messageCount: 0,
      sessionCount: 0,
      intentDistribution: {},
      hourlyMessageCount: Array(24).fill(0),
      dailyMessageCount: {},
      avgMessagesPerSession: 0,
      topKeywords: [],
      lastUpdated: Date.now()
    };
    
    if (!keepSessions) {
      this.sessionStatistics.clear();
    }
    
    this.saveStatistics();
    return true;
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.logger.info('开始清理StatisticsStrategy资源');
    
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.logger.debug('已清理定时保存任务');
    }
    
    try {
      this.saveStatistics();
      this.logger.info('StatisticsStrategy资源清理完成');
    } catch (error) {
      this.logger.error('清理时保存统计数据失败', { error: error.message });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'StatisticsStrategy.dispose' });
      }
    }
  }
}

export default StatisticsStrategy;