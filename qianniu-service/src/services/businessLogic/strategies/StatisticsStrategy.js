/**
 * 统计分析策略处理器
 * 负责对消息和会话进行统计和分析
 */
const fs = require('fs');
const path = require('path');

class StatisticsStrategy {
  constructor(options = {}) {
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
        this.saveStatistics();
      }, this.options.saveInterval);
    }
    
    console.log('统计分析策略处理器初始化完成');
  }
  
  /**
   * 加载统计数据
   */
  loadStatistics() {
    try {
      if (fs.existsSync(this.options.dataPath)) {
        const data = fs.readFileSync(this.options.dataPath, 'utf8');
        const loadedStats = JSON.parse(data);
        this.statistics = { ...this.statistics, ...loadedStats };
        console.log('统计数据加载成功');
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }
  
  /**
   * 保存统计数据
   */
  saveStatistics() {
    try {
      const dir = path.dirname(this.options.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      this.statistics.lastUpdated = Date.now();
      fs.writeFileSync(
        this.options.dataPath,
        JSON.stringify(this.statistics, null, 2),
        'utf8'
      );
      
      console.log('统计数据保存成功');
      return true;
    } catch (error) {
      console.error('保存统计数据失败:', error);
      return false;
    }
  }
  
  /**
   * 处理消息，更新统计数据
   * @param {Object} processedResult 消息处理结果
   * @param {Object} sessionContext 会话上下文
   * @returns {Object} 处理结果
   */
  process(processedResult, sessionContext) {
    if (!processedResult) {
      return { error: '无效的消息处理结果' };
    }
    
    try {
      // 提取必要信息
      const sessionId = sessionContext.id;
      const timestamp = processedResult.timestamp || Date.now();
      const intents = processedResult.intents || [];
      const bestIntent = intents.length > 0 ? intents[0].intent : 'unknown';
      const keywords = processedResult.parsedMessage?.keywords || [];
      
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
      
      return result;
    } catch (error) {
      console.error('统计处理出错:', error);
      return { error: error.message };
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
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
    }
    this.saveStatistics();
  }
}

module.exports = StatisticsStrategy; 