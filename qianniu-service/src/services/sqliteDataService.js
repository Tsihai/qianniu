/**
 * SQLite数据服务
 * 实现与DataService相同的接口，使用SQLite作为数据存储后端
 */

import { SQLiteConnectionManager } from '../config/sqliteConnection.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { getLogger } from '../utils/Logger.js';

// SQLite数据服务错误码
const SQLITE_DATA_ERROR_CODES = {
  CUSTOMER_NOT_FOUND: 'SQLITE_CUSTOMER_NOT_FOUND',
  SESSION_NOT_FOUND: 'SQLITE_SESSION_NOT_FOUND',
  INTENT_NOT_FOUND: 'SQLITE_INTENT_NOT_FOUND',
  DUPLICATE_ENTRY: 'SQLITE_DUPLICATE_ENTRY',
  INVALID_DATA: 'SQLITE_INVALID_DATA',
  OPERATION_FAILED: 'SQLITE_OPERATION_FAILED'
};

class SQLiteDataService {
  constructor(options = {}) {
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    this.options = {
      enableLogging: this.configManager ? this.configManager.get('logging.enabled', true) : (options.enableLogging || true),
      mockMode: this.configManager ? this.configManager.get('database.mockMode', process.env.DB_MOCK_MODE === 'true') : (process.env.DB_MOCK_MODE === 'true' || options.mockMode || false),
      ...options
    };
    
    this.logger = getLogger('SQLiteDataService');
    this.connectionManager = new SQLiteConnectionManager(this.configManager);
    
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
    
    this.log('SQLite数据服务初始化完成');
  }
  
  /**
   * 判断是否为Mock模式
   */
  get isMockMode() {
    return this.options.mockMode;
  }
  
  /**
   * 初始化数据服务
   */
  async initialize() {
    if (!this.isMockMode) {
      await this.connectionManager.initialize();
    }
  }
  
  /**
   * 客户相关操作
   */
  async getCustomer(clientId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        let customer = this.mockData.customers.get(clientId);
        
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
        
        return customer;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 查找现有客户
        let customer = await this.connectionManager.getQuery(
          connection,
          'SELECT * FROM customers WHERE client_id = ?',
          [clientId]
        );
        
        if (!customer) {
          // 创建新客户
          const now = Date.now();
          const result = await this.connectionManager.runQuery(
            connection,
            `INSERT INTO customers (
              client_id, nickname, avatar, contact, tags, purchase_intention,
              message_count, response_time, last_active_time, first_visit_time, visit_count,
              intent_stats, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, '', '', '{}', '[]', 0,
              0, 0, now, now, 1,
              '[]', now, now
            ]
          );
          
          // 重新查询获取完整数据
          customer = await this.connectionManager.getQuery(
            connection,
            'SELECT * FROM customers WHERE client_id = ?',
            [clientId]
          );
          
          this.log(`创建新客户: ${clientId}`);
        }
        
        // 转换数据格式
        return this.formatCustomerData(customer);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取客户信息失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'getCustomer',
        clientId
      });
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
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const now = Date.now();
        const updateFields = [];
        const updateValues = [];
        
        // 构建动态更新语句
        if (stats.messageCount !== undefined) {
          updateFields.push('message_count = ?');
          updateValues.push(stats.messageCount);
        }
        if (stats.responseTime !== undefined) {
          updateFields.push('response_time = ?');
          updateValues.push(stats.responseTime);
        }
        if (stats.visitCount !== undefined) {
          updateFields.push('visit_count = ?');
          updateValues.push(stats.visitCount);
        }
        
        updateFields.push('last_active_time = ?', 'updated_at = ?');
        updateValues.push(now, now, clientId);
        
        await this.connectionManager.runQuery(
          connection,
          `UPDATE customers SET ${updateFields.join(', ')} WHERE client_id = ?`,
          updateValues
        );
        
        return await this.getCustomer(clientId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`更新客户统计信息失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'updateCustomerStats',
        clientId,
        stats
      });
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
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 获取当前标签
        const customer = await this.connectionManager.getQuery(
          connection,
          'SELECT tags FROM customers WHERE client_id = ?',
          [clientId]
        );
        
        if (!customer) {
          throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.CUSTOMER_NOT_FOUND, {
            clientId
          });
        }
        
        const tags = JSON.parse(customer.tags || '[]');
        if (!tags.includes(tag)) {
          tags.push(tag);
          
          await this.connectionManager.runQuery(
            connection,
            'UPDATE customers SET tags = ?, updated_at = ? WHERE client_id = ?',
            [JSON.stringify(tags), Date.now(), clientId]
          );
        }
        
        return await this.getCustomer(clientId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`添加客户标签失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'addCustomerTag',
        clientId,
        tag
      });
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
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 获取当前意图统计
        const customer = await this.connectionManager.getQuery(
          connection,
          'SELECT intent_stats FROM customers WHERE client_id = ?',
          [clientId]
        );
        
        if (!customer) {
          throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.CUSTOMER_NOT_FOUND, {
            clientId
          });
        }
        
        const intentStats = JSON.parse(customer.intent_stats || '[]');
        const existingIntent = intentStats.find(i => i.intent === intent);
        
        if (existingIntent) {
          existingIntent.count++;
          existingIntent.lastTime = Date.now();
        } else {
          intentStats.push({
            intent,
            count: 1,
            firstTime: Date.now(),
            lastTime: Date.now()
          });
        }
        
        await this.connectionManager.runQuery(
          connection,
          'UPDATE customers SET intent_stats = ?, updated_at = ? WHERE client_id = ?',
          [JSON.stringify(intentStats), Date.now(), clientId]
        );
        
        return await this.getCustomer(clientId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`更新客户意图统计失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'updateCustomerIntentStats',
        clientId,
        intent
      });
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
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const customers = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM customers ORDER BY message_count DESC LIMIT ?',
          [limit]
        );
        
        return customers.map(customer => this.formatCustomerData(customer));
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取活跃客户失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'getTopCustomers',
        limit
      });
    }
  }
  
  /**
   * 会话相关操作
   */
  async getSession(sessionId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        return this.mockData.sessions.get(sessionId) || null;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const session = await this.connectionManager.getQuery(
          connection,
          'SELECT * FROM sessions WHERE session_id = ?',
          [sessionId]
        );
        
        if (!session) {
          return null;
        }
        
        // 获取会话消息
        const messages = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
          [sessionId]
        );
        
        return this.formatSessionData(session, messages);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取会话失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'getSession',
        sessionId
      });
    }
  }
  
  async createSession(sessionId, clientId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        let session = this.mockData.sessions.get(sessionId);
        
        if (session) {
          this.log(`会话已存在: ${sessionId}`);
          return session;
        }
        
        session = {
          sessionId,
          clientId,
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
          // 添加方法
          addMessage: async (message) => {
            const msgObj = {
              content: message.content,
              type: message.type || 'chat',
              sender: message.sender,
              timestamp: message.timestamp || Date.now(),
              metadata: message.metadata || {}
            };
            
            session.messages.push(msgObj);
            session.stats.messageCount += 1;
            if (message.sender === 'client' || message.sender === session.clientId) {
              session.stats.clientMessageCount += 1;
            } else {
              session.stats.serverMessageCount += 1;
            }
            session.stats.lastActivityTime = Date.now();
            return session;
          },
          updateContext: async (contextData) => {
            session.context = {
              ...session.context,
              ...contextData,
              lastMessageTime: Date.now()
            };
            return session;
          },
          close: async () => {
            session.status = 'closed';
            return session;
          },
          save: async () => session
        };
        
        this.mockData.sessions.set(sessionId, session);
        this.log(`创建新会话: ${sessionId} (客户: ${clientId})`);
        return session;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 检查会话是否已存在
        const existingSession = await this.connectionManager.getQuery(
          connection,
          'SELECT session_id FROM sessions WHERE session_id = ?',
          [sessionId]
        );
        
        if (existingSession) {
          this.log(`会话已存在: ${sessionId}`);
          return await this.getSession(sessionId);
        }
        
        // 创建新会话
        const now = Date.now();
        await this.connectionManager.runQuery(
          connection,
          `INSERT INTO sessions (
            session_id, client_id, status, message_count, client_message_count,
            server_message_count, start_time, last_activity_time, avg_response_time,
            last_intent, last_keywords, last_message_time, custom_data, tags,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId, clientId, 'active', 0, 0,
            0, now, now, 0,
            null, '[]', now, '{}', '[]',
            now, now
          ]
        );
        
        this.log(`创建新会话: ${sessionId} (客户: ${clientId})`);
        return await this.getSession(sessionId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`创建会话失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'createSession',
        sessionId,
        clientId
      });
    }
  }
  
  async addMessage(sessionId, message) {
    if (!message || !sessionId) {
      throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.INVALID_DATA, {
        reason: '消息或会话ID不能为空'
      });
    }
    
    try {
      // Mock模式
      if (this.isMockMode) {
        const session = this.mockData.sessions.get(sessionId);
        if (!session) {
          throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.SESSION_NOT_FOUND, {
            sessionId
          });
        }
        
        await session.addMessage(message);
        return session;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 检查会话是否存在
        const session = await this.connectionManager.getQuery(
          connection,
          'SELECT session_id FROM sessions WHERE session_id = ?',
          [sessionId]
        );
        
        if (!session) {
          throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.SESSION_NOT_FOUND, {
            sessionId
          });
        }
        
        // 添加消息
        const now = Date.now();
        await this.connectionManager.runQuery(
          connection,
          `INSERT INTO messages (
            session_id, content, type, sender, timestamp, metadata
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            message.content,
            message.type || 'chat',
            message.sender,
            message.timestamp || now,
            JSON.stringify(message.metadata || {})
          ]
        );
        
        // 更新会话统计
        const isClientMessage = message.sender === 'client';
        await this.connectionManager.runQuery(
          connection,
          `UPDATE sessions SET 
            message_count = message_count + 1,
            ${isClientMessage ? 'client_message_count = client_message_count + 1,' : 'server_message_count = server_message_count + 1,'}
            last_activity_time = ?,
            updated_at = ?
          WHERE session_id = ?`,
          [now, now, sessionId]
        );
        
        return await this.getSession(sessionId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`添加消息失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'addMessage',
        sessionId,
        message
      });
    }
  }
  
  async updateSessionContext(sessionId, contextData) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const session = this.mockData.sessions.get(sessionId);
        if (!session) return null;
        
        await session.updateContext(contextData);
        return session;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const updateFields = [];
        const updateValues = [];
        
        if (contextData.lastIntent !== undefined) {
          updateFields.push('last_intent = ?');
          updateValues.push(contextData.lastIntent);
        }
        
        if (contextData.lastKeywords !== undefined) {
          updateFields.push('last_keywords = ?');
          updateValues.push(JSON.stringify(contextData.lastKeywords));
        }
        
        if (contextData.customData !== undefined) {
          updateFields.push('custom_data = ?');
          updateValues.push(JSON.stringify(contextData.customData));
        }
        
        updateFields.push('last_message_time = ?', 'updated_at = ?');
        updateValues.push(Date.now(), Date.now(), sessionId);
        
        await this.connectionManager.runQuery(
          connection,
          `UPDATE sessions SET ${updateFields.join(', ')} WHERE session_id = ?`,
          updateValues
        );
        
        return await this.getSession(sessionId);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`更新会话上下文失败: ${error.message}`, 'error');
      return null;
    }
  }
  
  async closeSession(sessionId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const session = this.mockData.sessions.get(sessionId);
        if (!session) return false;
        
        await session.close();
        return true;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const result = await this.connectionManager.runQuery(
          connection,
          'UPDATE sessions SET status = ?, updated_at = ? WHERE session_id = ?',
          ['closed', Date.now(), sessionId]
        );
        
        return result.changes > 0;
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`关闭会话失败: ${error.message}`, 'error');
      return false;
    }
  }
  
  async getSessionsByClientId(clientId) {
    try {
      // Mock模式
      if (this.isMockMode) {
        return Array.from(this.mockData.sessions.values())
          .filter(session => session.clientId === clientId);
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const sessions = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM sessions WHERE client_id = ? ORDER BY created_at DESC',
          [clientId]
        );
        
        // 为每个会话获取消息（限制数量以提高性能）
        const sessionsWithMessages = await Promise.all(
          sessions.map(async (session) => {
            const messages = await this.connectionManager.allQuery(
              connection,
              'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10',
              [session.session_id]
            );
            return this.formatSessionData(session, messages);
          })
        );
        
        return sessionsWithMessages;
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取客户会话失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getActiveSessions(hours = 24) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return Array.from(this.mockData.sessions.values())
          .filter(session => session.stats.lastActivityTime > cutoff);
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        const sessions = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM sessions WHERE last_activity_time > ? ORDER BY last_activity_time DESC',
          [cutoff]
        );
        
        return sessions.map(session => this.formatSessionData(session, []));
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取活跃会话失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getSessionMessages(sessionId, limit = 20, skip = 0) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const session = this.mockData.sessions.get(sessionId);
        if (!session) return [];
        
        return session.messages.slice(skip, skip + limit);
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const messages = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?',
          [sessionId, limit, skip]
        );
        
        return messages.map(msg => ({
          content: msg.content,
          type: msg.type,
          sender: msg.sender,
          timestamp: msg.timestamp,
          metadata: JSON.parse(msg.metadata || '{}')
        }));
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取会话消息失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  /**
   * 意图模板相关操作
   */
  async getAllIntentTemplates() {
    try {
      // Mock模式
      if (this.isMockMode) {
        return Array.from(this.mockData.intents.values())
          .filter(intent => intent.isActive);
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const intents = await this.connectionManager.allQuery(
          connection,
          'SELECT * FROM intent_templates WHERE is_active = 1'
        );
        
        // 获取相关的patterns、keywords和templates
        const intentsWithDetails = await Promise.all(
          intents.map(async (intent) => {
            const [patterns, keywords, templates] = await Promise.all([
              this.connectionManager.allQuery(
                connection,
                'SELECT * FROM intent_patterns WHERE intent_template_id = ?',
                [intent.id]
              ),
              this.connectionManager.allQuery(
                connection,
                'SELECT * FROM intent_keywords WHERE intent_template_id = ?',
                [intent.id]
              ),
              this.connectionManager.allQuery(
                connection,
                'SELECT * FROM intent_template_responses WHERE intent_template_id = ?',
                [intent.id]
              )
            ]);
            
            return this.formatIntentTemplateData(intent, patterns, keywords, templates);
          })
        );
        
        return intentsWithDetails;
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取意图模板失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  async getIntentTemplate(name) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const intent = this.mockData.intents.get(name);
        return (intent && intent.isActive) ? intent : null;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const intent = await this.connectionManager.getQuery(
          connection,
          'SELECT * FROM intent_templates WHERE name = ? AND is_active = 1',
          [name]
        );
        
        if (!intent) return null;
        
        // 获取相关数据
        const [patterns, keywords, templates] = await Promise.all([
          this.connectionManager.allQuery(
            connection,
            'SELECT * FROM intent_patterns WHERE intent_template_id = ?',
            [intent.id]
          ),
          this.connectionManager.allQuery(
            connection,
            'SELECT * FROM intent_keywords WHERE intent_template_id = ?',
            [intent.id]
          ),
          this.connectionManager.allQuery(
            connection,
            'SELECT * FROM intent_template_responses WHERE intent_template_id = ?',
            [intent.id]
          )
        ]);
        
        return this.formatIntentTemplateData(intent, patterns, keywords, templates);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取意图模板失败: ${error.message}`, 'error');
      return null;
    }
  }
  
  async updateIntentStats(intentName, isMatched, isUsed) {
    try {
      // Mock模式
      if (this.isMockMode) {
        const intent = this.mockData.intents.get(intentName);
        if (!intent) return;
        
        if (isMatched) {
          intent.stats.matchCount++;
          intent.stats.lastUsed = Date.now();
        }
        
        if (isUsed) {
          intent.stats.usageCount++;
          if (intent.stats.matchCount > 0) {
            intent.stats.successRate = intent.stats.usageCount / intent.stats.matchCount;
          }
        }
        
        return;
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const updateFields = [];
        const updateValues = [];
        
        if (isMatched) {
          updateFields.push('match_count = match_count + 1');
          updateFields.push('last_used = ?');
          updateValues.push(Date.now());
        }
        
        if (isUsed) {
          updateFields.push('usage_count = usage_count + 1');
          updateFields.push('success_rate = CASE WHEN match_count > 0 THEN CAST(usage_count AS REAL) / match_count ELSE 0 END');
        }
        
        if (updateFields.length > 0) {
          updateValues.push(intentName);
          await this.connectionManager.runQuery(
            connection,
            `UPDATE intent_templates SET ${updateFields.join(', ')} WHERE name = ?`,
            updateValues
          );
        }
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`更新意图统计失败: ${error.message}`, 'error');
    }
  }
  
  /**
   * 创建意图模板
   */
  async createIntentTemplate(template) {
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
        
        return intentTemplate;
      }
      
      // SQLite模式
      return await this.connectionManager.executeTransaction(async (connection) => {
        // 检查是否已存在
        const existing = await this.connectionManager.getQuery(
          connection,
          'SELECT id FROM intent_templates WHERE name = ?',
          [template.name]
        );
        
        if (existing) {
          this.log(`意图模板已存在: ${template.name}`);
          return await this.getIntentTemplate(template.name);
        }
        
        // 创建主记录
        const now = Date.now();
        const result = await this.connectionManager.runQuery(
          connection,
          `INSERT INTO intent_templates (
            name, type, description, confidence_threshold, use_ml, use_patterns,
            use_keywords, priority, match_count, usage_count, success_rate,
            last_used, is_system, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            template.name,
            template.type || 'general',
            template.description || '',
            template.confidenceThreshold || 0.7,
            template.config?.useML ? 1 : 0,
            template.config?.usePatterns ? 1 : 0,
            template.config?.useKeywords ? 1 : 0,
            template.config?.priority || 1,
            0, 0, 0, null,
            template.isSystem ? 1 : 0,
            template.isActive !== false ? 1 : 0,
            now, now
          ]
        );
        
        const intentId = result.lastID;
        
        // 创建patterns
        if (template.patterns && template.patterns.length > 0) {
          for (const pattern of template.patterns) {
            await this.connectionManager.runQuery(
              connection,
              'INSERT INTO intent_patterns (intent_template_id, text, enabled) VALUES (?, ?, ?)',
              [intentId, pattern.text, pattern.enabled !== false ? 1 : 0]
            );
          }
        }
        
        // 创建keywords
        if (template.keywords && template.keywords.length > 0) {
          for (const keyword of template.keywords) {
            await this.connectionManager.runQuery(
              connection,
              'INSERT INTO intent_keywords (intent_template_id, word, weight) VALUES (?, ?, ?)',
              [intentId, keyword.word, keyword.weight || 1.0]
            );
          }
        }
        
        // 创建templates
        if (template.templates && template.templates.length > 0) {
          for (const tmpl of template.templates) {
            await this.connectionManager.runQuery(
              connection,
              'INSERT INTO intent_template_responses (intent_template_id, text, variables, conditions, weight, enabled) VALUES (?, ?, ?, ?, ?, ?)',
              [
                intentId,
                tmpl.text,
                JSON.stringify(tmpl.variables || []),
                JSON.stringify(tmpl.conditions || {}),
                tmpl.weight || 1.0,
                tmpl.enabled !== false ? 1 : 0
              ]
            );
          }
        }
        
        this.log(`创建意图模板: ${template.name}`);
        return await this.getIntentTemplate(template.name);
      });
      
    } catch (error) {
      this.log(`创建意图模板失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'createIntentTemplate',
        template
      });
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
        
        throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.INTENT_NOT_FOUND, {
          name
        });
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        // 检查意图是否存在
        const intent = await this.connectionManager.getQuery(
          connection,
          'SELECT id FROM intent_templates WHERE name = ?',
          [name]
        );
        
        if (!intent) {
          throw ErrorHandler.createError(SQLITE_DATA_ERROR_CODES.INTENT_NOT_FOUND, {
            name
          });
        }
        
        // 构建更新语句
        const updateFields = [];
        const updateValues = [];
        
        if (updates.description !== undefined) {
          updateFields.push('description = ?');
          updateValues.push(updates.description);
        }
        
        if (updates.confidenceThreshold !== undefined) {
          updateFields.push('confidence_threshold = ?');
          updateValues.push(updates.confidenceThreshold);
        }
        
        if (updates.config) {
          if (updates.config.useML !== undefined) {
            updateFields.push('use_ml = ?');
            updateValues.push(updates.config.useML ? 1 : 0);
          }
          if (updates.config.usePatterns !== undefined) {
            updateFields.push('use_patterns = ?');
            updateValues.push(updates.config.usePatterns ? 1 : 0);
          }
          if (updates.config.useKeywords !== undefined) {
            updateFields.push('use_keywords = ?');
            updateValues.push(updates.config.useKeywords ? 1 : 0);
          }
          if (updates.config.priority !== undefined) {
            updateFields.push('priority = ?');
            updateValues.push(updates.config.priority);
          }
        }
        
        if (updates.isActive !== undefined) {
          updateFields.push('is_active = ?');
          updateValues.push(updates.isActive ? 1 : 0);
        }
        
        updateFields.push('updated_at = ?');
        updateValues.push(Date.now(), name);
        
        await this.connectionManager.runQuery(
          connection,
          `UPDATE intent_templates SET ${updateFields.join(', ')} WHERE name = ?`,
          updateValues
        );
        
        return await this.getIntentTemplate(name);
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`更新意图模板失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'updateIntentTemplate',
        name,
        updates
      });
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
      
      // SQLite模式
      return await this.connectionManager.executeTransaction(async (connection) => {
        // 获取意图ID
        const intent = await this.connectionManager.getQuery(
          connection,
          'SELECT id FROM intent_templates WHERE name = ?',
          [name]
        );
        
        if (!intent) {
          return { deletedCount: 0 };
        }
        
        // 删除相关数据
        await Promise.all([
          this.connectionManager.runQuery(
            connection,
            'DELETE FROM intent_patterns WHERE intent_template_id = ?',
            [intent.id]
          ),
          this.connectionManager.runQuery(
            connection,
            'DELETE FROM intent_keywords WHERE intent_template_id = ?',
            [intent.id]
          ),
          this.connectionManager.runQuery(
            connection,
            'DELETE FROM intent_template_responses WHERE intent_template_id = ?',
            [intent.id]
          )
        ]);
        
        // 删除主记录
        const result = await this.connectionManager.runQuery(
          connection,
          'DELETE FROM intent_templates WHERE id = ?',
          [intent.id]
        );
        
        return { deletedCount: result.changes };
      });
      
    } catch (error) {
      this.log(`删除意图模板失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'deleteIntentTemplate',
        name
      });
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
      
      // SQLite模式
      let importCount = 0;
      
      for (const intent of intents) {
        try {
          // 检查是否已存在
          const connection = await this.connectionManager.getConnection();
          
          try {
            const existing = await this.connectionManager.getQuery(
              connection,
              'SELECT id FROM intent_templates WHERE name = ?',
              [intent.name]
            );
            
            if (!existing) {
              await this.createIntentTemplate(intent);
              importCount++;
            }
          } finally {
            this.connectionManager.releaseConnection(connection);
          }
        } catch (error) {
          this.log(`导入意图模板失败: ${intent.name} - ${error.message}`, 'warn');
        }
      }
      
      this.log(`导入${importCount}个默认意图模板`);
      return true;
      
    } catch (error) {
      this.log(`导入默认意图模板失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, SQLITE_DATA_ERROR_CODES.OPERATION_FAILED, {
        operation: 'importDefaultIntents',
        intents
      });
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
      
      // SQLite模式
      // TODO: 实现SQLite数据备份功能
      this.log('SQLite备份数据功能尚未实现');
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
      
      // SQLite模式
      // TODO: 实现SQLite数据恢复功能
      this.log('SQLite恢复数据功能尚未实现');
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
      // Mock模式
      if (this.isMockMode) {
        return {
          totalMessages: this.mockData.stats.messages.total,
          todayMessages: this.mockData.stats.messages.today
        };
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Date.now();
        
        const stats = await this.connectionManager.getQuery(
          connection,
          `SELECT 
            COUNT(*) as total_messages,
            COUNT(CASE WHEN sender = 'client' THEN 1 END) as client_messages,
            COUNT(CASE WHEN sender != 'client' THEN 1 END) as server_messages
          FROM messages 
          WHERE timestamp BETWEEN ? AND ?`,
          [start, end]
        );
        
        return stats || null;
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取消息统计失败: ${error.message}`, 'error');
      return null;
    }
  }
  
  async getIntentStats() {
    try {
      // Mock模式
      if (this.isMockMode) {
        return Array.from(this.mockData.intents.values())
          .filter(intent => intent.isActive)
          .map(intent => ({
            name: intent.name,
            type: intent.type,
            matchCount: intent.stats?.matchCount || 0,
            usageCount: intent.stats?.usageCount || 0,
            successRate: intent.stats?.successRate || 0,
            lastUsed: intent.stats?.lastUsed
          }))
          .sort((a, b) => b.matchCount - a.matchCount);
      }
      
      // SQLite模式
      const connection = await this.connectionManager.getConnection();
      
      try {
        const stats = await this.connectionManager.allQuery(
          connection,
          `SELECT 
            name, type, match_count as matchCount, usage_count as usageCount,
            success_rate as successRate, last_used as lastUsed
          FROM intent_templates 
          WHERE is_active = 1 
          ORDER BY match_count DESC`
        );
        
        return stats;
        
      } finally {
        this.connectionManager.releaseConnection(connection);
      }
      
    } catch (error) {
      this.log(`获取意图统计失败: ${error.message}`, 'error');
      return [];
    }
  }
  
  /**
   * 数据格式化方法
   */
  formatCustomerData(customer) {
    if (!customer) return null;
    
    return {
      clientId: customer.client_id,
      nickname: customer.nickname || '',
      avatar: customer.avatar || '',
      contact: JSON.parse(customer.contact || '{}'),
      tags: JSON.parse(customer.tags || '[]'),
      purchaseIntention: customer.purchase_intention || 0,
      stats: {
        messageCount: customer.message_count || 0,
        responseTime: customer.response_time || 0,
        lastActiveTime: customer.last_active_time,
        firstVisitTime: customer.first_visit_time,
        visitCount: customer.visit_count || 1
      },
      intentStats: JSON.parse(customer.intent_stats || '[]'),
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at)
    };
  }
  
  formatSessionData(session, messages = []) {
    if (!session) return null;
    
    const formattedSession = {
      sessionId: session.session_id,
      clientId: session.client_id,
      status: session.status,
      messages: messages.map(msg => ({
        content: msg.content,
        type: msg.type,
        sender: msg.sender,
        timestamp: msg.timestamp,
        metadata: JSON.parse(msg.metadata || '{}')
      })),
      stats: {
        messageCount: session.message_count || 0,
        clientMessageCount: session.client_message_count || 0,
        serverMessageCount: session.server_message_count || 0,
        startTime: session.start_time,
        lastActivityTime: session.last_activity_time,
        avgResponseTime: session.avg_response_time || 0
      },
      context: {
        lastIntent: session.last_intent,
        lastKeywords: JSON.parse(session.last_keywords || '[]'),
        lastMessageTime: session.last_message_time,
        customData: JSON.parse(session.custom_data || '{}')
      },
      tags: JSON.parse(session.tags || '[]'),
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at)
    };
    
    // 添加方法（与原DataService兼容）
    formattedSession.addMessage = async (message) => {
      return await this.addMessage(session.session_id, message);
    };
    
    formattedSession.updateContext = async (contextData) => {
      return await this.updateSessionContext(session.session_id, contextData);
    };
    
    formattedSession.close = async () => {
      return await this.closeSession(session.session_id);
    };
    
    formattedSession.save = async () => {
      return formattedSession;
    };
    
    return formattedSession;
  }
  
  formatIntentTemplateData(intent, patterns = [], keywords = [], templates = []) {
    if (!intent) return null;
    
    const formattedIntent = {
      name: intent.name,
      type: intent.type,
      description: intent.description,
      confidenceThreshold: intent.confidence_threshold,
      patterns: patterns.map(p => ({
        text: p.text,
        enabled: p.enabled === 1
      })),
      keywords: keywords.map(k => ({
        word: k.word,
        weight: k.weight
      })),
      templates: templates.map(t => ({
        text: t.text,
        variables: JSON.parse(t.variables || '[]'),
        conditions: JSON.parse(t.conditions || '{}'),
        weight: t.weight,
        enabled: t.enabled === 1
      })),
      config: {
        useML: intent.use_ml === 1,
        usePatterns: intent.use_patterns === 1,
        useKeywords: intent.use_keywords === 1,
        priority: intent.priority
      },
      stats: {
        matchCount: intent.match_count || 0,
        usageCount: intent.usage_count || 0,
        successRate: intent.success_rate || 0,
        lastUsed: intent.last_used
      },
      isSystem: intent.is_system === 1,
      isActive: intent.is_active === 1,
      createdAt: new Date(intent.created_at),
      updatedAt: new Date(intent.updated_at)
    };
    
    // 添加方法（与原DataService兼容）
    formattedIntent.incrementMatchCount = async () => {
      return await this.updateIntentStats(intent.name, true, false);
    };
    
    formattedIntent.incrementUsageCount = async () => {
      return await this.updateIntentStats(intent.name, false, true);
    };
    
    formattedIntent.save = async () => {
      return formattedIntent;
    };
    
    return formattedIntent;
  }
  
  /**
   * 获取连接池统计信息
   */
  getConnectionPoolStats() {
    if (this.isMockMode) {
      return {
        active: 0,
        idle: 1,
        total: 1,
        pending: 0,
        maxConnections: 1,
        minConnections: 1,
        type: 'mock'
      };
    }
    
    if (!this.connectionManager || !this.connectionManager.pool) {
      return {
        active: 0,
        idle: 0,
        total: 0,
        pending: 0,
        maxConnections: 0,
        minConnections: 0,
        type: 'sqlite',
        status: 'not_initialized'
      };
    }
    
    const poolStatus = this.connectionManager.pool.getStatus();
    return {
      active: poolStatus.activeConnections,
      idle: poolStatus.availableConnections,
      total: poolStatus.totalConnections,
      pending: poolStatus.pendingRequests,
      maxConnections: poolStatus.maxConnections,
      minConnections: poolStatus.minConnections,
      type: 'sqlite',
      status: poolStatus.isInitialized ? 'initialized' : 'not_initialized',
      isDestroyed: poolStatus.isDestroyed
    };
  }

  /**
   * 获取连接池健康状态
   */
  async getConnectionPoolHealth() {
    if (this.isMockMode) {
      return {
        status: 'healthy',
        type: 'mock',
        timestamp: new Date().toISOString()
      };
    }
    
    if (!this.connectionManager) {
      return {
        status: 'unhealthy',
        type: 'sqlite',
        error: 'Connection manager not initialized',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      const healthResult = await this.connectionManager.healthCheck();
      return {
        ...healthResult,
        type: 'sqlite'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: 'sqlite',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 关闭数据服务
   */
  async close() {
    if (this.connectionManager) {
      await this.connectionManager.close();
    }
  }

  /**
   * 记录日志
   * @param {string} message 日志消息
   * @param {string} level 日志级别
   */
  log(message, level = 'info') {
    if (!this.options.enableLogging) return;
    
    this.logger[level] ? this.logger[level](message) : this.logger.info(message);
  }
}

export default SQLiteDataService;