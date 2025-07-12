/**
 * 数据服务
 * 提供统一的数据持久化访问接口
 */

import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import SmartQueryCache from '../cache/SmartQueryCache.js';

class DataService {
  constructor(options = {}) {
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    this.options = {
      enableLogging: this.configManager ? this.configManager.get('logging.enabled', true) : (options.enableLogging || true),
      mockMode: this.configManager ? this.configManager.get('database.mockMode', process.env.DB_MOCK_MODE === 'true') : (process.env.DB_MOCK_MODE === 'true' || options.mockMode || false),
      host: this.configManager ? this.configManager.get('database.host', 'localhost') : (options.host || 'localhost'),
      port: this.configManager ? this.configManager.get('database.port', 27017) : (options.port || 27017),
      database: this.configManager ? this.configManager.get('database.database', 'qianniu') : (options.database || 'qianniu'),
      username: this.configManager ? this.configManager.get('database.username', '') : (options.username || ''),
      password: this.configManager ? this.configManager.get('database.password', '') : (options.password || ''),
      ...options
    };
    
    // 初始化标志
    this.initialized = false;
    
    // 初始化性能监控器
    this.performanceMonitor = new PerformanceMonitor({
      enableLogging: this.options.enableLogging,
      alertRules: [
        {
          name: 'database_slow_query',
          condition: (metrics) => {
            const avgResponseTime = metrics.find(m => m.type === 'RESPONSE_TIME')?.statistics?.average || 0;
            return avgResponseTime > 1000; // 超过1秒的查询
          },
          level: 'WARNING',
          message: '数据库查询响应时间过慢'
        },
        {
          name: 'high_error_rate',
          condition: (metrics) => {
            const errorRate = metrics.find(m => m.type === 'ERROR_RATE')?.value || 0;
            return errorRate > 0.05; // 错误率超过5%
          },
          level: 'CRITICAL',
          message: '数据库操作错误率过高'
        }
      ]
    });
    
    // 启动性能监控
    this.performanceMonitor.start();
    
    // 初始化查询缓存
    this.queryCache = new SmartQueryCache({
      defaultTTL: 300000, // 5分钟
      maxTTL: 3600000, // 1小时
      minTTL: 30000, // 30秒
      cleanupInterval: 60000 // 1分钟清理一次
    });
    
    // 配置缓存策略
    this.queryCache.strategies = {
      getCustomer: { ttl: 600000, priority: 'high' }, // 客户数据10分钟
      getSession: { ttl: 300000, priority: 'medium' }, // 会话数据5分钟
      getAllIntentTemplates: { ttl: 900000, priority: 'high' }, // 意图模板15分钟
      getStatistics: { ttl: 120000, priority: 'low' }, // 统计数据2分钟
      getSessionsByClientId: { ttl: 180000, priority: 'medium' }, // 客户会话3分钟
      getActiveSessions: { ttl: 60000, priority: 'medium' } // 活跃会话1分钟
    };
    
    // 初始化mock数据
    this.initializeMockData();
  }
  
  /**
   * 异步初始化方法
   */
  async initialize() {
    if (this.initialized) return;
    
    // 只在非mock模式下加载models
    if (!this.options.mockMode) {
      const { Customer, Session, IntentTemplate } = await import('../models/index.js');
      this.Customer = Customer;
      this.Session = Session;
      this.IntentTemplate = IntentTemplate;
    }
    
    this.initialized = true;
  }
  
  /**
   * 初始化Mock数据
   */
  initializeMockData() {
     if (this.options.mockMode) {
       // 初始化mock数据存储
       this.mockData = {
         customers: new Map(),
         sessions: new Map(),
         intents: new Map()
       };
       
       // Mock模式下创建mock对象
       this.Customer = {
        findByClientId: async (clientId) => {
          return this.mockData.customers.get(clientId) || null;
        },
        create: async (data) => {
          const customer = {
            ...data,
            _id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
            save: async () => customer
          };
          this.mockData.customers.set(data.clientId, customer);
          return customer;
        },
        find: async () => {
          return Array.from(this.mockData.customers.values());
        }
      };
      
      this.Session = {
        findOne: async (query) => {
          if (query.sessionId) {
            return this.mockData.sessions.get(query.sessionId) || null;
          }
          return null;
        },
        create: async (data) => {
           const session = {
             ...data,
             _id: Date.now().toString(),
             messages: [],
             stats: {
               messageCount: 0,
               clientMessageCount: 0,
               serverMessageCount: 0,
               startTime: Date.now(),
               lastActivityTime: Date.now(),
               avgResponseTime: 0
             },
             context: {
               lastIntent: null,
               lastKeywords: [],
               lastMessageTime: Date.now(),
               customData: new Map()
             },
             status: 'active',
             tags: [],
             createdAt: new Date(),
             updatedAt: new Date(),
             save: async () => session,
             addMessage: async function(message) {
               const msgObj = {
                 content: message.content,
                 type: message.type || 'chat',
                 sender: message.sender,
                 timestamp: message.timestamp || Date.now(),
                 metadata: message.metadata || {}
               };
               
               this.messages.push(msgObj);
               this.stats.messageCount += 1;
               if (message.sender === 'client' || message.sender === this.clientId) {
                 this.stats.clientMessageCount += 1;
               } else {
                 this.stats.serverMessageCount += 1;
               }
               this.stats.lastActivityTime = Date.now();
               return this.save();
             },
             updateContext: async function(contextData) {
               this.context = {
                 ...this.context,
                 ...contextData,
                 lastMessageTime: Date.now()
               };
               return this.save();
             },
             close: async function() {
               this.status = 'closed';
               return this.save();
             }
           };
           this.mockData.sessions.set(data.sessionId, session);
           return session;
         },
        findByClientId: async (clientId) => {
          return Array.from(this.mockData.sessions.values())
            .filter(session => session.clientId === clientId);
        },
        findActive: async (hours = 24) => {
          const cutoff = Date.now() - (hours * 60 * 60 * 1000);
          return Array.from(this.mockData.sessions.values())
            .filter(session => session.lastActiveTime > cutoff);
        }
      };
      
      this.IntentTemplate = {
        findActive: async () => {
          return Array.from(this.mockData.intents.values())
            .filter(intent => intent.isActive);
        },
        findOne: async (query) => {
          return Array.from(this.mockData.intents.values())
            .find(intent => {
              if (query.name && query.isActive !== undefined) {
                return intent.name === query.name && intent.isActive === query.isActive;
              }
              if (query.name) {
                return intent.name === query.name;
              }
              return false;
            }) || null;
        },
        create: async (data) => {
          const intent = {
            ...data,
            _id: Date.now().toString(),
            stats: {
              matchCount: 0,
              usageCount: 0,
              successRate: 0,
              lastUsed: null
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            save: async () => intent,
            incrementMatchCount: async function() {
              this.stats.matchCount += 1;
              this.stats.lastUsed = Date.now();
              return this.save();
            },
            incrementUsageCount: async function() {
              this.stats.usageCount += 1;
              if (this.stats.matchCount > 0) {
                this.stats.successRate = this.stats.usageCount / this.stats.matchCount;
              }
              return this.save();
            }
          };
          this.mockData.intents.set(data.name, intent);
          return intent;
        },
        deleteOne: async (query) => {
          if (query.name && this.mockData.intents.has(query.name)) {
            this.mockData.intents.delete(query.name);
            return { deletedCount: 1 };
          }
          return { deletedCount: 0 };
        },
        importDefaults: async (intents) => {
          let count = 0;
          for (const intent of intents) {
            if (!this.mockData.intents.has(intent.name)) {
              this.mockData.intents.set(intent.name, {
                ...intent,
                _id: Date.now().toString() + count,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              count++;
            }
          }
          return count;
        }
      };
    }
    
    // 模拟数据（在mock模式下使用）
    if (this.options.mockMode) {
      this.mockData = {
        customers: new Map(),
        sessions: new Map(),
        intents: new Map(),
        stats: {
          messages: { total: 0, today: 0 },
          intents: []
        }
      };
    }
    
    this.log('数据服务初始化完成');
  }
  
  /**
   * 判断是否为Mock模式
   */
  get isMockMode() {
    return this.options.mockMode;
  }

  /**
   * 客户相关操作
   */
  async getCustomer(clientId) {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = { clientId };
      const cachedResult = this.queryCache.getQueryResult('getCustomer', cacheKey);
      if (cachedResult !== null) {
        this.performanceMonitor.recordResponseTime('getCustomer', Date.now() - startTime);
        return cachedResult;
      }
      
      let customer = null;
      
      // Mock模式
      if (this.isMockMode) {
        customer = this.mockData.customers.get(clientId);
        
        if (!customer) {
          customer = {
            clientId,
            nickname: '',
            avatar: '',
            contact: {},
            tags: [],
            purchaseIntention: 0,
            stats: {
              messageCount: 0,
              responseTime: 0,
              lastActiveTime: Date.now(),
              firstVisitTime: Date.now(),
              visitCount: 1
            },
            intentStats: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          this.mockData.customers.set(clientId, customer);
          this.log(`创建新客户: ${clientId} (Mock)`);
        }
      } else {
        // 数据库模式
        customer = await this.Customer.findByClientId(clientId);
        
        if (!customer) {
          // 如果客户不存在，则创建新客户
          customer = await this.Customer.create({
            clientId,
            stats: {
              firstVisitTime: Date.now(),
              lastActiveTime: Date.now()
            }
          });
          
          this.log(`创建新客户: ${clientId}`);
        }
      }
      
      // 缓存结果
      this.queryCache.setQueryResult('getCustomer', cacheKey, customer);
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('getCustomer', Date.now() - startTime);
      return customer;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getCustomer', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取客户信息失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 更新客户统计信息
   */
  async updateCustomerStats(clientId, stats) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const customer = await this.getCustomer(clientId);
        customer.stats = {
          ...customer.stats,
          ...stats,
          lastActiveTime: Date.now()
        };
        customer.updatedAt = new Date();
        return customer;
      }
      
      // 数据库模式
      const customer = await this.getCustomer(clientId);
      
      if (customer) {
        // 更新统计信息
        Object.assign(customer.stats, stats, { 
          lastActiveTime: Date.now() 
        });
        
        await customer.save();
      }
      
      return customer;
    } catch (error) {
      this.log(`更新客户统计信息失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 添加客户标签
   */
  async addCustomerTag(clientId, tag) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const customer = await this.getCustomer(clientId);
        if (!customer.tags.includes(tag)) {
          customer.tags.push(tag);
        }
        customer.updatedAt = new Date();
        return customer;
      }
      
      // 数据库模式
      const customer = await this.getCustomer(clientId);
      
      if (customer && !customer.tags.includes(tag)) {
        customer.tags.push(tag);
        await customer.save();
      }
      
      return customer;
    } catch (error) {
      this.log(`添加客户标签失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 更新客户意图统计
   */
  async updateCustomerIntentStats(clientId, intent) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const customer = await this.getCustomer(clientId);
        
        const existingIntent = customer.intentStats?.find(i => i.intent === intent);
        if (existingIntent) {
          existingIntent.count++;
          existingIntent.lastTime = Date.now();
        } else {
          if (!customer.intentStats) {
            customer.intentStats = [];
          }
          customer.intentStats.push({
            intent,
            count: 1,
            firstTime: Date.now(),
            lastTime: Date.now()
          });
        }
        
        customer.updatedAt = new Date();
        return customer;
      }
      
      // 数据库模式
      const customer = await this.getCustomer(clientId);
      
      if (customer) {
        const existingIntent = customer.intentStats?.find(i => i.intent === intent);
        if (existingIntent) {
          existingIntent.count++;
          existingIntent.lastTime = Date.now();
        } else {
          if (!customer.intentStats) {
            customer.intentStats = [];
          }
          customer.intentStats.push({
            intent,
            count: 1,
            firstTime: Date.now(),
            lastTime: Date.now()
          });
        }
        
        await customer.save();
      }
      
      return customer;
    } catch (error) {
      this.log(`更新客户意图统计失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 获取活跃客户
   */
  async getTopCustomers(limit = 10) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const customers = Array.from(this.mockData.customers.values());
        return customers
          .sort((a, b) => (b.stats?.messageCount || 0) - (a.stats?.messageCount || 0))
          .slice(0, limit);
      }
      
      // 数据库模式
      return await this.Customer.find()
        .sort({ 'stats.messageCount': -1 })
        .limit(limit);
    } catch (error) {
      this.log(`获取活跃客户失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 会话相关操作
   */
  async getSession(sessionId) {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = { sessionId };
      const cachedResult = this.queryCache.getQueryResult('getSession', cacheKey);
      if (cachedResult !== null) {
        this.performanceMonitor.recordResponseTime('getSession', Date.now() - startTime);
        return cachedResult;
      }
      
      let session = await this.Session.findOne({ sessionId });
      
      if (!session) {
        // 如果会话不存在，说明出错了，因为会话应该在创建时就已经保存
        this.log(`会话不存在: ${sessionId}`, 'error');
        // 缓存null结果
        this.queryCache.setQueryResult('getSession', cacheKey, null);
        this.performanceMonitor.recordResponseTime('getSession', Date.now() - startTime);
        return null;
      }
      
      // 缓存结果
      this.queryCache.setQueryResult('getSession', cacheKey, session);
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('getSession', Date.now() - startTime);
      return session;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getSession', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取会话失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async createSession(sessionId, clientId) {
    const startTime = Date.now();
    
    try {
      // 检查会话是否已存在
      let session = await this.Session.findOne({ sessionId });
      
      if (session) {
        this.log(`会话已存在: ${sessionId}`);
        // 记录性能指标
        this.performanceMonitor.recordResponseTime('createSession', Date.now() - startTime);
        return session;
      }
      
      // 创建新会话
      session = await this.Session.create({
        sessionId,
        clientId,
        status: 'active',
        stats: {
          startTime: Date.now(),
          lastActivityTime: Date.now()
        }
      });
      
      this.log(`创建新会话: ${sessionId} (客户: ${clientId})`);
      
      // 失效相关缓存
      this.queryCache.invalidateQuery('getSessionsByClientId');
      this.queryCache.invalidateQuery('getActiveSessions');
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('createSession', Date.now() - startTime);
      return session;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('createSession', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`创建会话失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async addMessage(sessionId, message) {
    const startTime = Date.now();
    
    if (!message || !sessionId) {
      throw new Error('消息或会话ID不能为空');
    }
    
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`);
      }
      
      await session.addMessage(message);
      
      // 失效相关缓存（消息变更可能影响会话状态）
      this.queryCache.invalidateQuery('getSession', { sessionId });
      this.queryCache.invalidateQuery('getActiveSessions');
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('addMessage', Date.now() - startTime);
      return session;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('addMessage', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`添加消息失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  async updateSessionContext(sessionId, contextData) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;
      
      await session.updateContext(contextData);
      return session;
    } catch (error) {
      this.log(`更新会话上下文失败: ${error.message}`, 'error');
    }
  }
  
  async closeSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;
      
      await session.close();
      return true;
    } catch (error) {
      this.log(`关闭会话失败: ${error.message}`, 'error');
      return false;
    }
  }
  
  async getSessionsByClientId(clientId) {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = { clientId };
      const cachedResult = this.queryCache.getQueryResult('getSessionsByClientId', cacheKey);
      if (cachedResult !== null) {
        this.performanceMonitor.recordResponseTime('getSessionsByClientId', Date.now() - startTime);
        return cachedResult;
      }
      
      const sessions = await this.Session.findByClientId(clientId);
      
      // 缓存结果
      this.queryCache.setQueryResult('getSessionsByClientId', cacheKey, sessions);
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('getSessionsByClientId', Date.now() - startTime);
      return sessions;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getSessionsByClientId', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取客户会话失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getActiveSessions(hours = 24) {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = { hours };
      const cachedResult = this.queryCache.getQueryResult('getActiveSessions', cacheKey);
      if (cachedResult !== null) {
        this.performanceMonitor.recordResponseTime('getActiveSessions', Date.now() - startTime);
        return cachedResult;
      }
      
      const sessions = await this.Session.findActive(hours);
      
      // 缓存结果（较短的TTL，因为活跃会话变化频繁）
      this.queryCache.setQueryResult('getActiveSessions', cacheKey, sessions);
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('getActiveSessions', Date.now() - startTime);
      return sessions;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getActiveSessions', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取活跃会话失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getSessionMessages(sessionId, limit = 20, skip = 0) {
    try {
      const session = await this.Session.findOne(
        { sessionId }, 
        { messages: { $slice: [skip, limit] } }
      );
      
      return session ? session.messages : [];
    } catch (error) {
      this.log(`获取会话消息失败: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * 意图模板相关操作
   */
  async getAllIntentTemplates() {
    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = { active: true };
      const cachedResult = this.queryCache.getQueryResult('getAllIntentTemplates', cacheKey);
      if (cachedResult !== null) {
        this.performanceMonitor.recordResponseTime('getAllIntentTemplates', Date.now() - startTime);
        return cachedResult;
      }
      
      const result = await this.IntentTemplate.findActive();
      
      // 缓存结果
      this.queryCache.setQueryResult('getAllIntentTemplates', cacheKey, result);
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('getAllIntentTemplates', Date.now() - startTime);
      return result;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getAllIntentTemplates', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取意图模板失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getIntentTemplate(name) {
    try {
      return await this.IntentTemplate.findOne({ name, isActive: true });
    } catch (error) {
      this.log(`获取意图模板失败: ${error.message}`, 'error');
      return null;
    }
  }
  
  async updateIntentStats(intentName, isMatched, isUsed) {
    const startTime = Date.now();
    
    try {
      const intent = await this.IntentTemplate.findOne({ name: intentName });
      
      if (!intent) {
        this.performanceMonitor.recordResponseTime('updateIntentStats', Date.now() - startTime);
        return;
      }
      
      if (isMatched) {
        await intent.incrementMatchCount();
      }
      
      if (isUsed) {
        await intent.incrementUsageCount();
      }
      
      // 失效统计相关缓存
      this.queryCache.invalidateQuery('getStatistics');
      this.queryCache.invalidateQuery('getAllIntentTemplates');
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('updateIntentStats', Date.now() - startTime);
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('updateIntentStats', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`更新意图统计失败: ${error.message}`, 'error');
    }
  }

  /**
   * 创建意图模板
   */
  async createIntentTemplate(template) {
    const startTime = Date.now();
    
    try {
      // Mock模式
      if (this.isMockMode) {
        const intentTemplate = {
          ...template,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        this.mockData.intents.set(template.name, intentTemplate);
        this.log(`创建意图模板: ${template.name} (Mock)`);
        
        // 记录性能指标
        this.performanceMonitor.recordResponseTime('createIntentTemplate', Date.now() - startTime);
        return intentTemplate;
      }
      
      // 数据库模式
      let intentTemplate = await this.IntentTemplate.findOne({ name: template.name });
      
      if (intentTemplate) {
        this.log(`意图模板已存在: ${template.name}`);
        this.performanceMonitor.recordResponseTime('createIntentTemplate', Date.now() - startTime);
        return intentTemplate;
      }
      
      intentTemplate = await this.IntentTemplate.create(template);
      this.log(`创建意图模板: ${template.name}`);
      
      // 失效意图模板相关缓存
      this.queryCache.invalidateQuery('getAllIntentTemplates');
      
      // 记录性能指标
      this.performanceMonitor.recordResponseTime('createIntentTemplate', Date.now() - startTime);
      return intentTemplate;
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('createIntentTemplate', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`创建意图模板失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 更新意图模板
   */
  async updateIntentTemplate(name, updates) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const intentTemplate = this.mockData.intents.get(name);
        
        if (intentTemplate) {
          Object.assign(intentTemplate, updates);
          intentTemplate.updatedAt = new Date();
          
          return intentTemplate;
        }
        
        throw new Error(`意图模板不存在: ${name}`);
      }
      
      // 数据库模式
      const intentTemplate = await this.IntentTemplate.findOne({ name });
      
      if (!intentTemplate) {
        throw new Error(`意图模板不存在: ${name}`);
      }
      
      Object.assign(intentTemplate, updates);
      await intentTemplate.save();
      
      return intentTemplate;
    } catch (error) {
      this.log(`更新意图模板失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 删除意图模板
   */
  async deleteIntentTemplate(name) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const deleted = this.mockData.intents.delete(name);
        return { deleted };
      }
      
      // 数据库模式
      const result = await this.IntentTemplate.deleteOne({ name });
      return result;
    } catch (error) {
      this.log(`删除意图模板失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 导入默认意图数据
   */
  async importDefaultIntents(intents) {
    try {
      // Mock模式
      if (this.isMockMode) {
        intents.forEach(intent => {
          this.mockData.intents.set(intent.name, {
            ...intent,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
        
        this.log(`导入${intents.length}个默认意图模板 (Mock)`);
        return true;
      }
      
      // 数据库模式
      const importCount = await this.IntentTemplate.importDefaults(intents);
      this.log(`导入${importCount}个默认意图模板`);
      
      return true;
    } catch (error) {
      this.log(`导入默认意图模板失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 备份数据
   */
  async backupData() {
    try {
      // Mock模式
      if (this.isMockMode) {
        this.log('备份数据功能在Mock模式下不可用');
        return false;
      }
      
      // 数据库模式
      // TODO: 实现数据备份功能
      this.log('备份数据功能尚未实现');
      return false;
    } catch (error) {
      this.log(`备份数据失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 恢复数据
   */
  async restoreData(backupId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        this.log('恢复数据功能在Mock模式下不可用');
        return false;
      }
      
      // 数据库模式
      // TODO: 实现数据恢复功能
      this.log('恢复数据功能尚未实现');
      return false;
    } catch (error) {
      this.log(`恢复数据失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 统计数据相关操作
   */
  async getMessageStats(startDate, endDate) {
    try {
      const stats = await Session.getMessageStats(startDate, endDate);
      return stats.length > 0 ? stats[0] : null;
    } catch (error) {
      this.log(`获取消息统计失败: ${error.message}`, 'error');
      return null;
    }
  }
  
  async getIntentStats() {
    try {
      return await IntentTemplate.aggregate([
        { $match: { isActive: true } },
        { $sort: { 'stats.matchCount': -1 } },
        { $project: {
          name: 1,
          type: 1,
          matchCount: '$stats.matchCount',
          usageCount: '$stats.usageCount',
          successRate: '$stats.successRate',
          lastUsed: '$stats.lastUsed'
        }}
      ]);
    } catch (error) {
      this.log(`获取意图统计失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  /**
   * 获取统计数据
   */
  async getStatistics() {
    const startTime = Date.now();
    
    try {
      // Mock模式
      if (this.isMockMode) {
        // 返回模拟的统计数据
        const result = [{
          messageCount: this.mockData.statistics?.messageCount || 0,
          sessionCount: this.mockData.statistics?.sessionCount || 0,
          intentDistribution: this.mockData.statistics?.intentDistribution || {},
          hourlyMessageCount: this.mockData.statistics?.hourlyMessageCount || Array(24).fill(0),
          dailyMessageCount: this.mockData.statistics?.dailyMessageCount || {},
          avgMessagesPerSession: this.mockData.statistics?.avgMessagesPerSession || 0,
          topKeywords: this.mockData.statistics?.topKeywords || [],
          lastUpdated: this.mockData.statistics?.lastUpdated || Date.now()
        }];
        
        // 记录性能指标
        this.performanceMonitor.recordResponseTime('getStatistics', Date.now() - startTime);
        return result;
      }
      
      // 数据库模式 - 这里需要根据实际的统计数据模型来实现
      // 暂时返回空数组，表示没有统计数据
      this.performanceMonitor.recordResponseTime('getStatistics', Date.now() - startTime);
      return [];
    } catch (error) {
      // 记录错误和性能指标
      this.performanceMonitor.recordResponseTime('getStatistics', Date.now() - startTime);
      this.performanceMonitor.recordCustomMetric('database_error', 1, 'COUNT');
      this.log(`获取统计数据失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  /**
   * 保存统计数据
   */
  async saveStatistics(statisticsData) {
    try {
      // Mock模式
      if (this.isMockMode) {
        if (!this.mockData.statistics) {
          this.mockData.statistics = {};
        }
        
        // 更新模拟统计数据
        Object.assign(this.mockData.statistics, statisticsData);
        this.log('统计数据保存成功 (Mock)');
        return true;
      }
      
      // 数据库模式 - 这里需要根据实际的统计数据模型来实现
      // 暂时只记录日志
      this.log('统计数据保存功能尚未实现 (数据库模式)');
      return true;
    } catch (error) {
      this.log(`保存统计数据失败: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * 获取性能统计报告
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    if (!this.performanceMonitor) {
      return {
        error: '性能监控器未初始化',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      const summary = this.performanceMonitor.getSummary();
      const cacheStats = this.queryCache.getQueryStats();
      
      return {
        timestamp: new Date().toISOString(),
        service: 'DataService',
        metrics: {
          responseTime: {
            getCustomer: this._getMetricStats('getCustomer'),
            createSession: this._getMetricStats('createSession'),
            addMessage: this._getMetricStats('addMessage'),
            getAllIntentTemplates: this._getMetricStats('getAllIntentTemplates'),
            updateIntentStats: this._getMetricStats('updateIntentStats'),
            createIntentTemplate: this._getMetricStats('createIntentTemplate'),
            getStatistics: this._getMetricStats('getStatistics'),
            getSessionsByClientId: this._getMetricStats('getSessionsByClientId'),
            getActiveSessions: this._getMetricStats('getActiveSessions')
          },
          cache: {
            hitRate: cacheStats.hitRate,
            totalQueries: cacheStats.totalQueries,
            cacheHits: cacheStats.cacheHits,
            cacheMisses: cacheStats.cacheMisses,
            memoryUsage: cacheStats.memoryUsage,
            queryTypes: cacheStats.queryTypes
          },
          errors: {
            databaseErrors: this._getCounterValue('database_error')
          },
          system: summary.systemInfo || {},
          alerts: summary.alerts || []
        },
        summary: {
          totalOperations: this._getTotalOperations(),
          averageResponseTime: this._getAverageResponseTime(),
          errorRate: this._getErrorRate()
        }
      };
    } catch (error) {
      this.log(`获取性能统计失败: ${error.message}`, 'error');
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 缓存管理方法
   */
  
  /**
   * 预热缓存
   * @param {Array} operations 要预热的操作列表
   * @returns {Object} 预热结果
   */
  async warmupCache(operations = []) {
    const startTime = Date.now();
    const results = {
      success: [],
      failed: [],
      totalTime: 0,
      timestamp: new Date().toISOString()
    };
    
    try {
      this.log('开始缓存预热...');
      
      // 默认预热操作
      const defaultOperations = [
        { type: 'getAllIntentTemplates', params: {} },
        { type: 'getActiveSessions', params: { hours: 24 } },
        { type: 'getStatistics', params: {} }
      ];
      
      const operationsToWarmup = operations.length > 0 ? operations : defaultOperations;
      
      for (const operation of operationsToWarmup) {
        try {
          const opStartTime = Date.now();
          
          switch (operation.type) {
            case 'getAllIntentTemplates':
              await this.getAllIntentTemplates();
              break;
            case 'getActiveSessions':
              await this.getActiveSessions(operation.params.hours || 24);
              break;
            case 'getStatistics':
              await this.getStatistics();
              break;
            case 'getCustomer':
              if (operation.params.clientId) {
                await this.getCustomer(operation.params.clientId);
              }
              break;
            case 'getSessionsByClientId':
              if (operation.params.clientId) {
                await this.getSessionsByClientId(operation.params.clientId);
              }
              break;
            default:
              throw new Error(`未知的预热操作类型: ${operation.type}`);
          }
          
          const opTime = Date.now() - opStartTime;
          results.success.push({
            type: operation.type,
            params: operation.params,
            time: opTime
          });
          
          this.log(`预热操作完成: ${operation.type} (${opTime}ms)`);
        } catch (error) {
          results.failed.push({
            type: operation.type,
            params: operation.params,
            error: error.message
          });
          
          this.log(`预热操作失败: ${operation.type} - ${error.message}`, 'warn');
        }
      }
      
      results.totalTime = Date.now() - startTime;
      this.log(`缓存预热完成，耗时: ${results.totalTime}ms，成功: ${results.success.length}，失败: ${results.failed.length}`);
      
      return results;
    } catch (error) {
      this.log(`缓存预热失败: ${error.message}`, 'error');
      results.totalTime = Date.now() - startTime;
      results.error = error.message;
      return results;
    }
  }
  
  /**
   * 清理缓存
   * @param {Object} options 清理选项
   * @returns {Object} 清理结果
   */
  clearCache(options = {}) {
    try {
      const beforeStats = this.queryCache.getQueryStats();
      
      if (options.queryType) {
        // 清理特定类型的查询缓存
        this.queryCache.invalidateQuery(options.queryType);
        this.log(`清理缓存类型: ${options.queryType}`);
      } else if (options.all) {
        // 清理所有缓存
        this.queryCache.clearAll();
        this.log('清理所有缓存');
      } else {
        // 清理过期缓存
        this.queryCache.cleanup();
        this.log('清理过期缓存');
      }
      
      const afterStats = this.queryCache.getQueryStats();
      
      return {
        success: true,
        before: beforeStats,
        after: afterStats,
        cleared: {
          entries: beforeStats.totalQueries - afterStats.totalQueries,
          memory: beforeStats.memoryUsage - afterStats.memoryUsage
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`清理缓存失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 获取缓存状态
   * @returns {Object} 缓存状态信息
   */
  getCacheStatus() {
    try {
      const stats = this.queryCache.getQueryStats();
      const strategies = this.queryCache.strategies;
      
      return {
        enabled: true,
        stats: stats,
        strategies: strategies,
        config: {
          defaultTTL: this.queryCache.defaultTTL,
          maxTTL: this.queryCache.maxTTL,
          minTTL: this.queryCache.minTTL,
          cleanupInterval: this.queryCache.cleanupInterval
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`获取缓存状态失败: ${error.message}`, 'error');
      return {
        enabled: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 更新缓存策略
   * @param {string} queryType 查询类型
   * @param {Object} strategy 缓存策略
   * @returns {Object} 更新结果
   */
  updateCacheStrategy(queryType, strategy) {
    try {
      if (!queryType || !strategy) {
        throw new Error('查询类型和策略不能为空');
      }
      
      const oldStrategy = this.queryCache.strategies[queryType];
      this.queryCache.strategies[queryType] = {
        ...oldStrategy,
        ...strategy
      };
      
      this.log(`更新缓存策略: ${queryType}`);
      
      return {
        success: true,
        queryType: queryType,
        oldStrategy: oldStrategy,
        newStrategy: this.queryCache.strategies[queryType],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`更新缓存策略失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 获取缓存详细信息
   * @param {string} queryType 查询类型（可选）
   * @returns {Object} 缓存详细信息
   */
  getCacheDetails(queryType = null) {
    try {
      if (queryType) {
        // 获取特定查询类型的缓存详情
        const details = this.queryCache.getQueryDetails(queryType);
        return {
          queryType: queryType,
          details: details,
          timestamp: new Date().toISOString()
        };
      } else {
        // 获取所有缓存详情
        const allDetails = this.queryCache.getAllDetails();
        return {
          allQueries: allDetails,
          summary: this.queryCache.getQueryStats(),
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      this.log(`获取缓存详情失败: ${error.message}`, 'error');
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 获取特定操作的性能指标统计
   * @private
   */
  _getMetricStats(operation) {
    try {
      const metrics = this.performanceMonitor.getMetrics('RESPONSE_TIME', Date.now() - 3600000, Date.now());
      const operationMetrics = metrics.filter(m => m.tags && m.tags.operation === operation);
      
      if (operationMetrics.length === 0) {
        return { count: 0, average: 0, min: 0, max: 0 };
      }
      
      const values = operationMetrics.map(m => m.value);
      return {
        count: values.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    } catch (error) {
      return { count: 0, average: 0, min: 0, max: 0, error: error.message };
    }
  }
  
  /**
   * 获取计数器值
   * @private
   */
  _getCounterValue(counterName) {
    try {
      return this.performanceMonitor.getCounter(counterName) || 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * 获取总操作数
   * @private
   */
  _getTotalOperations() {
    const operations = ['getCustomer', 'createSession', 'addMessage', 'getAllIntentTemplates', 'updateIntentStats', 'createIntentTemplate', 'getStatistics'];
    return operations.reduce((total, op) => {
      const stats = this._getMetricStats(op);
      return total + stats.count;
    }, 0);
  }
  
  /**
   * 获取平均响应时间
   * @private
   */
  _getAverageResponseTime() {
    const operations = ['getCustomer', 'createSession', 'addMessage', 'getAllIntentTemplates', 'updateIntentStats', 'createIntentTemplate', 'getStatistics'];
    let totalTime = 0;
    let totalCount = 0;
    
    operations.forEach(op => {
      const stats = this._getMetricStats(op);
      totalTime += stats.average * stats.count;
      totalCount += stats.count;
    });
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }
  
  /**
   * 获取错误率
   * @private
   */
  _getErrorRate() {
    const totalOperations = this._getTotalOperations();
    const totalErrors = this._getCounterValue('database_error');
    
    return totalOperations > 0 ? totalErrors / totalOperations : 0;
  }
  
  /**
   * 生成告警信息
   * @private
   * @param {Object} responseTimeStats 响应时间统计
   * @param {Object} customMetrics 自定义指标
   * @param {Object} cacheStats 缓存统计
   * @returns {Array} 告警列表
   */
  _generateAlerts(responseTimeStats, customMetrics, cacheStats = {}) {
    const alerts = [];
    
    // 检查响应时间告警
    Object.keys(responseTimeStats).forEach(operation => {
      const stats = responseTimeStats[operation];
      if (stats && stats.average > 1000) { // 平均响应时间超过1秒
        alerts.push({
          type: 'performance',
          level: 'warning',
          operation: operation,
          message: `${operation} 平均响应时间过长: ${stats.average.toFixed(2)}ms`,
          value: stats.average,
          threshold: 1000
        });
      }
    });
    
    // 检查错误率告警
    const errorRate = this._getErrorRate();
    if (errorRate > 0.05) { // 错误率超过5%
      alerts.push({
        type: 'error',
        level: 'critical',
        message: `数据库错误率过高: ${(errorRate * 100).toFixed(2)}%`,
        value: errorRate,
        threshold: 0.05
      });
    }
    
    // 检查缓存命中率告警
    if (cacheStats.hitRate !== undefined && cacheStats.hitRate < 60) { // 命中率低于60%
      alerts.push({
        type: 'cache',
        level: 'warning',
        message: `缓存命中率过低: ${cacheStats.hitRate.toFixed(2)}%`,
        value: cacheStats.hitRate,
        threshold: 60
      });
    }
    
    // 检查缓存内存使用告警
    if (cacheStats.memoryUsage && cacheStats.memoryUsage > 100 * 1024 * 1024) { // 超过100MB
      alerts.push({
        type: 'cache',
        level: 'warning',
        message: `缓存内存使用过高: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        value: cacheStats.memoryUsage,
        threshold: 100 * 1024 * 1024
      });
    }
    
    return alerts;
  }
  
  /**
   * 获取连接池统计信息
   * @returns {Object} 连接池统计信息
   */
  async getConnectionPoolStats() {
    try {
      if (this.isMockMode) {
        return {
          active: 1,
          idle: 0,
          total: 1,
          pending: 0,
          maxConnections: 1,
          minConnections: 1,
          type: 'mongodb-mock',
          status: 'healthy'
        };
      }

      // 获取Mongoose连接实例
      const mongoose = await import('mongoose');
      const connection = mongoose.connection;
      
      if (!connection || connection.readyState !== 1) {
        return {
          active: 0,
          idle: 0,
          total: 0,
          pending: 0,
          maxConnections: 0,
          minConnections: 0,
          type: 'mongodb',
          status: 'disconnected'
        };
      }

      // 从Mongoose连接获取连接池信息
      const db = connection.db;
      const client = connection.getClient();
      
      // 获取连接池统计（如果可用）
      let poolStats = {
        active: 1, // Mongoose默认单连接
        idle: 0,
        total: 1,
        pending: 0,
        maxConnections: this.options.maxPoolSize || 10,
        minConnections: 1,
        type: 'mongodb',
        status: 'healthy'
      };

      // 尝试获取更详细的连接池信息
      if (client && client.topology && client.topology.s) {
        const topology = client.topology.s;
        if (topology.coreTopology && topology.coreTopology.s) {
          const pool = topology.coreTopology.s.pool;
          if (pool) {
            poolStats.active = pool.totalConnectionCount || 1;
            poolStats.idle = pool.availableConnectionCount || 0;
            poolStats.total = poolStats.active + poolStats.idle;
            poolStats.pending = pool.waitQueueSize || 0;
          }
        }
      }

      return poolStats;
    } catch (error) {
      this.log(`获取连接池统计失败: ${error.message}`, 'error');
      return {
        active: 0,
        idle: 0,
        total: 0,
        pending: 0,
        maxConnections: 0,
        minConnections: 0,
        type: 'mongodb',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 获取连接池健康状态
   * @returns {Object} 连接池健康状态
   */
  async getConnectionPoolHealth() {
    try {
      if (this.isMockMode) {
        return {
          healthy: true,
          status: 'mock',
          message: 'Mock模式运行正常',
          details: {
            connectionState: 'mock',
            lastCheck: new Date().toISOString()
          }
        };
      }

      const mongoose = await import('mongoose');
      const connection = mongoose.connection;
      
      if (!connection) {
        return {
          healthy: false,
          status: 'no_connection',
          message: '无数据库连接实例',
          details: {
            connectionState: 'none',
            lastCheck: new Date().toISOString()
          }
        };
      }

      const readyState = connection.readyState;
      const stateNames = ['断开', '已连接', '连接中', '断开中'];
      const stateName = stateNames[readyState] || '未知';
      
      const isHealthy = readyState === 1; // 1 表示已连接
      
      return {
        healthy: isHealthy,
        status: isHealthy ? 'connected' : 'disconnected',
        message: isHealthy ? 'MongoDB连接正常' : `MongoDB连接异常: ${stateName}`,
        details: {
          connectionState: stateName,
          readyState: readyState,
          host: connection.host,
          port: connection.port,
          name: connection.name,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        message: `连接池健康检查失败: ${error.message}`,
        details: {
          error: error.message,
          lastCheck: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 记录日志
   * @param {string} message 日志消息
   * @param {string} level 日志级别
   */
  log(message, level = 'info') {
    if (!this.options.enableLogging) return;
    
    const logMsg = `[DataService] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMsg);
        break;
      case 'warn':
        console.warn(logMsg);
        break;
      default:
        console.log(logMsg);
    }
  }
}

export default DataService;