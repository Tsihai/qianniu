/**
 * 客户行为分析策略处理器
 * 负责分析客户行为特征，为个性化交互提供支持
 */
const fs = require('fs');
const path = require('path');

class CustomerBehaviorStrategy {
  constructor(options = {}) {
    // 配置选项
    this.options = {
      dataPath: options?.dataPath || path.join(__dirname, '../data/customer_behavior.json'),
      saveInterval: options?.saveInterval || 1800000, // 30分钟保存一次
      maxCustomerProfiles: options?.maxCustomerProfiles || 10000,
      behaviorPatterns: options?.behaviorPatterns || [
        { name: 'price_sensitive', keywords: ['价格', '便宜', '优惠', '打折', '促销', '便宜点'] },
        { name: 'quality_focused', keywords: ['质量', '好评', '耐用', '材质', '品质', '保障'] },
        { name: 'service_oriented', keywords: ['客服', '服务', '态度', '响应', '售后', '换货'] },
        { name: 'shipping_concerned', keywords: ['发货', '物流', '快递', '送货', '到货', '时间'] },
        { name: 'product_detail', keywords: ['尺寸', '颜色', '规格', '参数', '材料', '功能'] }
      ],
      ...options
    };
    
    // 客户行为数据
    this.customerProfiles = new Map();
    
    // 加载历史数据
    this.loadData();
    
    // 设置定时保存
    if (this.options.saveInterval > 0) {
      this.saveIntervalId = setInterval(() => {
        this.saveData();
      }, this.options.saveInterval);
    }
    
    console.log('客户行为分析策略处理器初始化完成');
  }
  
  /**
   * 加载客户行为数据
   */
  loadData() {
    try {
      if (fs.existsSync(this.options.dataPath)) {
        const data = fs.readFileSync(this.options.dataPath, 'utf8');
        const profiles = JSON.parse(data);
        
        // 转换为Map
        this.customerProfiles = new Map();
        Object.entries(profiles).forEach(([clientId, profile]) => {
          this.customerProfiles.set(clientId, profile);
        });
        
        console.log(`加载了 ${this.customerProfiles.size} 条客户行为数据`);
      }
    } catch (error) {
      console.error('加载客户行为数据失败:', error);
    }
  }
  
  /**
   * 保存客户行为数据
   */
  saveData() {
    try {
      const dir = path.dirname(this.options.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 将Map转换为对象
      const profiles = {};
      this.customerProfiles.forEach((profile, clientId) => {
        profiles[clientId] = profile;
      });
      
      fs.writeFileSync(
        this.options.dataPath,
        JSON.stringify(profiles, null, 2),
        'utf8'
      );
      
      console.log('客户行为数据保存成功');
      return true;
    } catch (error) {
      console.error('保存客户行为数据失败:', error);
      return false;
    }
  }
  
  /**
   * 处理消息，分析客户行为
   * @param {Object} processedResult 消息处理结果
   * @param {Object} sessionContext 会话上下文
   * @returns {Object} 处理结果
   */
  process(processedResult, sessionContext) {
    if (!processedResult || !processedResult.parsedMessage) {
      return { error: '无效的消息处理结果' };
    }
    
    try {
      // 提取必要信息
      const clientId = sessionContext.id;
      const content = processedResult.parsedMessage.cleanContent;
      const keywords = processedResult.parsedMessage.keywords || [];
      const timestamp = processedResult.timestamp || Date.now();
      const intent = processedResult.bestIntent?.intent || 'unknown';
      
      // 获取或创建客户资料
      const profile = this.getOrCreateProfile(clientId);
      
      // 更新客户资料
      this.updateProfile(profile, content, keywords, intent, timestamp);
      
      // 分析行为特征
      const behaviorTraits = this.analyzeBehaviorTraits(profile);
      
      // 构建返回结果
      return {
        clientId,
        customerInfo: {
          lastActivity: timestamp,
          messageCount: profile.messageCount,
          dominantTrait: behaviorTraits.dominantTrait,
          traits: behaviorTraits.traits
        },
        recommendedApproach: this.getRecommendedApproach(behaviorTraits)
      };
    } catch (error) {
      console.error('客户行为分析出错:', error);
      return { error: error.message };
    }
  }
  
  /**
   * 获取或创建客户资料
   * @param {string} clientId 客户ID
   * @returns {Object} 客户资料
   */
  getOrCreateProfile(clientId) {
    // 如果不存在则创建新资料
    if (!this.customerProfiles.has(clientId)) {
      this.customerProfiles.set(clientId, {
        id: clientId,
        firstSeen: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        intents: {},
        keywords: {},
        behaviorPatterns: {},
        interactions: []
      });
      
      // 如果超出最大配置，清理最旧的资料
      if (this.customerProfiles.size > this.options.maxCustomerProfiles) {
        this.cleanupOldProfiles();
      }
    }
    
    return this.customerProfiles.get(clientId);
  }
  
  /**
   * 更新客户资料
   * @param {Object} profile 客户资料
   * @param {string} content 消息内容
   * @param {Array} keywords 关键词
   * @param {string} intent 意图
   * @param {number} timestamp 时间戳
   */
  updateProfile(profile, content, keywords, intent, timestamp) {
    // 更新基本信息
    profile.lastActivity = timestamp;
    profile.messageCount++;
    
    // 更新意图统计
    if (!profile.intents[intent]) {
      profile.intents[intent] = 0;
    }
    profile.intents[intent]++;
    
    // 更新关键词统计
    keywords.forEach(keyword => {
      if (!profile.keywords[keyword]) {
        profile.keywords[keyword] = 0;
      }
      profile.keywords[keyword]++;
    });
    
    // 更新行为模式统计
    this.options.behaviorPatterns.forEach(pattern => {
      if (!profile.behaviorPatterns[pattern.name]) {
        profile.behaviorPatterns[pattern.name] = 0;
      }
      
      const matchingKeywords = pattern.keywords.filter(k => 
        content.includes(k) || keywords.includes(k)
      );
      
      if (matchingKeywords.length > 0) {
        profile.behaviorPatterns[pattern.name] += matchingKeywords.length;
      }
    });
    
    // 添加交互记录
    profile.interactions.push({
      timestamp,
      content,
      intent,
      keywords
    });
    
    // 限制交互历史数量
    if (profile.interactions.length > 20) {
      profile.interactions = profile.interactions.slice(-20);
    }
  }
  
  /**
   * 分析客户行为特征
   * @param {Object} profile 客户资料
   * @returns {Object} 行为特征分析结果
   */
  analyzeBehaviorTraits(profile) {
    const traits = {};
    let dominantTrait = null;
    let maxScore = 0;
    
    // 计算各行为模式的分数
    Object.entries(profile.behaviorPatterns).forEach(([trait, count]) => {
      const score = count / Math.max(1, profile.messageCount);
      traits[trait] = Math.min(1, score);
      
      if (score > maxScore) {
        maxScore = score;
        dominantTrait = trait;
      }
    });
    
    return {
      dominantTrait,
      traits
    };
  }
  
  /**
   * 获取推荐的交互方式
   * @param {Object} behaviorTraits 行为特征分析结果
   * @returns {Object} 推荐的交互方式
   */
  getRecommendedApproach(behaviorTraits) {
    const { dominantTrait, traits } = behaviorTraits;
    
    // 针对不同行为特征的推荐交互方式
    const approaches = {
      'price_sensitive': {
        focus: '价格与优惠',
        tone: '强调实惠与价值',
        prioritize: ['优惠信息', '性价比', '价格比较']
      },
      'quality_focused': {
        focus: '品质与性能',
        tone: '专业详尽的说明',
        prioritize: ['品质保障', '用户评价', '耐用程度']
      },
      'service_oriented': {
        focus: '服务体验',
        tone: '热情且迅速回应',
        prioritize: ['服务承诺', '售后保障', '响应速度']
      },
      'shipping_concerned': {
        focus: '物流与发货',
        tone: '清晰的时间安排',
        prioritize: ['发货时效', '物流跟踪', '送货方式']
      },
      'product_detail': {
        focus: '产品细节',
        tone: '具体且详细',
        prioritize: ['规格参数', '使用方法', '功能对比']
      }
    };
    
    return dominantTrait && approaches[dominantTrait] 
      ? approaches[dominantTrait] 
      : {
          focus: '综合信息',
          tone: '平衡友好',
          prioritize: ['基本信息', '常见问题', '个性化需求']
        };
  }
  
  /**
   * 清理旧的客户资料
   */
  cleanupOldProfiles() {
    // 将所有资料按最后活动时间排序
    const profilesArray = [];
    this.customerProfiles.forEach((profile, clientId) => {
      profilesArray.push({ id: clientId, lastActivity: profile.lastActivity });
    });
    
    profilesArray.sort((a, b) => a.lastActivity - b.lastActivity);
    
    // 删除最旧的10%资料
    const deleteCount = Math.ceil(this.customerProfiles.size * 0.1);
    for (let i = 0; i < deleteCount; i++) {
      if (i < profilesArray.length) {
        this.customerProfiles.delete(profilesArray[i].id);
      }
    }
    
    console.log(`清理了 ${deleteCount} 条旧的客户资料`);
  }
  
  /**
   * 获取客户资料
   * @param {string} clientId 客户ID
   * @returns {Object|null} 客户资料
   */
  getCustomerProfile(clientId) {
    return this.customerProfiles.get(clientId) || null;
  }
  
  /**
   * 设置客户信息
   * @param {string} clientId 客户ID
   * @param {Object} info 客户信息
   * @returns {boolean} 是否成功
   */
  setCustomerInfo(clientId, info) {
    const profile = this.getOrCreateProfile(clientId);
    
    profile.info = {
      ...profile.info,
      ...info,
      lastUpdated: Date.now()
    };
    
    return true;
  }
  
  /**
   * 清理资源
   */
  dispose() {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
    }
    this.saveData();
  }
}

module.exports = CustomerBehaviorStrategy; 