/**
 * 统一会话管理器
 * 提供会话创建、更新、查询、删除的统一接口，支持自动清理、状态监控和内存优化
 */

import { EventEmitter } from 'events';
import { ErrorHandler } from './ErrorHandler.js';
import { getLogger } from './Logger.js';

// 会话状态枚举
const SESSION_STATUS = {
  ACTIVE: 'active',
  IDLE: 'idle',
  EXPIRED: 'expired',
  TERMINATED: 'terminated'
};

// 会话类型枚举
const SESSION_TYPE = {
  WEBSOCKET: 'websocket',
  MESSAGE: 'message',
  BUSINESS: 'business'
};

// 默认配置
const DEFAULT_CONFIG = {
  maxSessions: 10000,
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  cleanupInterval: 5 * 60 * 1000,  // 5分钟清理一次
  maxIdleTime: 15 * 60 * 1000,     // 15分钟无活动则标记为idle
  enablePersistence: false,
  persistenceFile: './data/sessions.json',
  enableMetrics: true
};

/**
 * 会话数据结构
 */
class Session {
  constructor(id, type, data = {}) {
    this.id = id;
    this.type = type;
    this.status = SESSION_STATUS.ACTIVE;
    this.data = data;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.lastAccessAt = new Date();
    this.expiresAt = new Date(Date.now() + DEFAULT_CONFIG.sessionTimeout);
    this.metadata = {
      accessCount: 0,
      dataSize: 0
    };
  }
  
  /**
   * 更新会话数据
   */
  update(data) {
    this.data = { ...this.data, ...data };
    this.updatedAt = new Date();
    this.lastAccessAt = new Date();
    this.metadata.accessCount++;
    this.metadata.dataSize = JSON.stringify(this.data).length;
    
    // 重置过期时间
    this.expiresAt = new Date(Date.now() + DEFAULT_CONFIG.sessionTimeout);
    
    // 如果是idle状态，重新激活
    if (this.status === SESSION_STATUS.IDLE) {
      this.status = SESSION_STATUS.ACTIVE;
    }
  }
  
  /**
   * 访问会话（更新最后访问时间）
   */
  access() {
    this.lastAccessAt = new Date();
    this.metadata.accessCount++;
    
    if (this.status === SESSION_STATUS.IDLE) {
      this.status = SESSION_STATUS.ACTIVE;
    }
  }
  
  /**
   * 检查会话是否过期
   */
  isExpired() {
    return Date.now() > this.expiresAt.getTime();
  }
  
  /**
   * 检查会话是否空闲
   */
  isIdle(maxIdleTime = DEFAULT_CONFIG.maxIdleTime) {
    return Date.now() - this.lastAccessAt.getTime() > maxIdleTime;
  }
  
  /**
   * 标记会话为过期
   */
  expire() {
    this.status = SESSION_STATUS.EXPIRED;
  }
  
  /**
   * 终止会话
   */
  terminate() {
    this.status = SESSION_STATUS.TERMINATED;
  }
  
  /**
   * 序列化会话数据
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      data: this.data,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastAccessAt: this.lastAccessAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      metadata: this.metadata
    };
  }
  
  /**
   * 从JSON数据恢复会话
   */
  static fromJSON(json) {
    const session = new Session(json.id, json.type, json.data);
    session.status = json.status;
    session.createdAt = new Date(json.createdAt);
    session.updatedAt = new Date(json.updatedAt);
    session.lastAccessAt = new Date(json.lastAccessAt);
    session.expiresAt = new Date(json.expiresAt);
    session.metadata = json.metadata || { accessCount: 0, dataSize: 0 };
    return session;
  }
}

/**
 * 会话统计信息
 */
class SessionMetrics {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.totalSessions = 0;
    this.activeSessions = 0;
    this.idleSessions = 0;
    this.expiredSessions = 0;
    this.terminatedSessions = 0;
    this.sessionsByType = {};
    this.memoryUsage = 0;
    this.averageSessionSize = 0;
    this.peakSessions = 0;
    this.totalCreated = 0;
    this.totalDestroyed = 0;
    this.lastCleanupAt = null;
  }
  
  update(sessions) {
    this.totalSessions = sessions.size;
    this.activeSessions = 0;
    this.idleSessions = 0;
    this.expiredSessions = 0;
    this.terminatedSessions = 0;
    this.sessionsByType = {};
    
    let totalSize = 0;
    
    for (const session of sessions.values()) {
      // 统计状态
      switch (session.status) {
        case SESSION_STATUS.ACTIVE:
          this.activeSessions++;
          break;
        case SESSION_STATUS.IDLE:
          this.idleSessions++;
          break;
        case SESSION_STATUS.EXPIRED:
          this.expiredSessions++;
          break;
        case SESSION_STATUS.TERMINATED:
          this.terminatedSessions++;
          break;
      }
      
      // 统计类型
      this.sessionsByType[session.type] = (this.sessionsByType[session.type] || 0) + 1;
      
      // 计算大小
      totalSize += session.metadata.dataSize || 0;
    }
    
    this.memoryUsage = totalSize;
    this.averageSessionSize = this.totalSessions > 0 ? totalSize / this.totalSessions : 0;
    this.peakSessions = Math.max(this.peakSessions, this.totalSessions);
  }
}

/**
 * 统一会话管理器
 */
class SessionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessions = new Map();
    this.indices = {
      byUserId: new Map(),
      byConnectionId: new Map(),
      byType: new Map()
    };
    
    this.metrics = new SessionMetrics();
    this.logger = getLogger('SessionManager');
    this.cleanupTimer = null;
    this.isShuttingDown = false;
    
    // 启动自动清理
    this.startCleanup();
    
    // 加载持久化数据
    if (this.config.enablePersistence) {
      this.loadSessions();
    }
    
    this.logger.info('SessionManager initialized', {
      config: this.config,
      enablePersistence: this.config.enablePersistence
    });
  }
  
  /**
   * 创建新会话
   */
  createSession(id, type, data = {}) {
    try {
      // 检查会话数量限制
      if (this.sessions.size >= this.config.maxSessions) {
        throw ErrorHandler.createError('VALIDATION_ERROR', 
          `Maximum sessions limit (${this.config.maxSessions}) reached`);
      }
      
      // 检查会话是否已存在
      if (this.sessions.has(id)) {
        throw ErrorHandler.createError('VALIDATION_ERROR', 
          `Session with id ${id} already exists`);
      }
      
      const session = new Session(id, type, data);
      this.sessions.set(id, session);
      
      // 更新索引
      this.updateIndices(session, 'add');
      
      // 更新统计
      this.metrics.totalCreated++;
      if (this.config.enableMetrics) {
        this.metrics.update(this.sessions);
      }
      
      // 触发事件
      this.emit('sessionCreated', session);
      
      this.logger.debug('Session created', {
        sessionId: id,
        type,
        totalSessions: this.sessions.size
      });
      
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', { sessionId: id, type }, error);
      throw error;
    }
  }
  
  /**
   * 获取会话
   */
  getSession(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.access();
      return session;
    }
    return null;
  }
  
  /**
   * 根据用户ID获取会话
   */
  getSessionByUserId(userId) {
    const sessionIds = this.indices.byUserId.get(userId) || [];
    return sessionIds.map(id => this.sessions.get(id)).filter(Boolean);
  }
  
  /**
   * 根据连接ID获取会话
   */
  getSessionByConnectionId(connectionId) {
    const sessionId = this.indices.byConnectionId.get(connectionId);
    return sessionId ? this.sessions.get(sessionId) : null;
  }
  
  /**
   * 根据类型获取会话
   */
  getSessionsByType(type) {
    const sessionIds = this.indices.byType.get(type) || [];
    return sessionIds.map(id => this.sessions.get(id)).filter(Boolean);
  }
  
  /**
   * 更新会话数据
   */
  updateSession(id, data) {
    try {
      const session = this.sessions.get(id);
      if (!session) {
        throw ErrorHandler.createError('NOT_FOUND', `Session ${id} not found`);
      }
      
      const oldData = { ...session.data };
      session.update(data);
      
      // 更新索引（如果用户ID或连接ID发生变化）
      this.updateIndices(session, 'update', oldData);
      
      // 更新统计
      if (this.config.enableMetrics) {
        this.metrics.update(this.sessions);
      }
      
      // 触发事件
      this.emit('sessionUpdated', session, oldData);
      
      this.logger.debug('Session updated', {
        sessionId: id,
        dataSize: session.metadata.dataSize
      });
      
      return session;
    } catch (error) {
      this.logger.error('Failed to update session', { sessionId: id }, error);
      throw error;
    }
  }
  
  /**
   * 删除会话
   */
  deleteSession(id) {
    try {
      const session = this.sessions.get(id);
      if (!session) {
        return false;
      }
      
      // 标记为终止
      session.terminate();
      
      // 从索引中移除
      this.updateIndices(session, 'remove');
      
      // 从主存储中移除
      this.sessions.delete(id);
      
      // 更新统计
      this.metrics.totalDestroyed++;
      if (this.config.enableMetrics) {
        this.metrics.update(this.sessions);
      }
      
      // 触发事件
      this.emit('sessionDeleted', session);
      
      this.logger.debug('Session deleted', {
        sessionId: id,
        totalSessions: this.sessions.size
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to delete session', { sessionId: id }, error);
      throw error;
    }
  }
  
  /**
   * 清理过期和空闲会话
   */
  cleanupSessions() {
    try {
      const now = Date.now();
      const expiredSessions = [];
      const idleSessions = [];
      
      for (const [id, session] of this.sessions) {
        if (session.isExpired()) {
          expiredSessions.push(id);
        } else if (session.isIdle(this.config.maxIdleTime)) {
          idleSessions.push(id);
        }
      }
      
      // 删除过期会话
      for (const id of expiredSessions) {
        const session = this.sessions.get(id);
        if (session) {
          session.expire();
          this.emit('sessionExpired', session);
          this.deleteSession(id);
        }
      }
      
      // 标记空闲会话
      for (const id of idleSessions) {
        const session = this.sessions.get(id);
        if (session && session.status === SESSION_STATUS.ACTIVE) {
          session.status = SESSION_STATUS.IDLE;
          this.emit('sessionIdle', session);
        }
      }
      
      this.metrics.lastCleanupAt = new Date();
      
      if (expiredSessions.length > 0 || idleSessions.length > 0) {
        this.logger.info('Session cleanup completed', {
          expiredCount: expiredSessions.length,
          idleCount: idleSessions.length,
          totalSessions: this.sessions.size
        });
      }
      
      // 持久化数据
      if (this.config.enablePersistence) {
        this.saveSessions();
      }
      
      return {
        expired: expiredSessions.length,
        idle: idleSessions.length,
        total: this.sessions.size
      };
    } catch (error) {
      this.logger.error('Session cleanup failed', {}, error);
      throw error;
    }
  }
  
  /**
   * 获取所有会话
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
  
  /**
   * 获取会话统计信息
   */
  getMetrics() {
    if (this.config.enableMetrics) {
      this.metrics.update(this.sessions);
    }
    return { ...this.metrics };
  }
  
  /**
   * 获取会话详情
   */
  getSessionDetail(id) {
    const session = this.getSession(id);
    if (!session) {
      return null;
    }
    
    return {
      ...session.toJSON(),
      isExpired: session.isExpired(),
      isIdle: session.isIdle(this.config.maxIdleTime),
      timeToExpire: session.expiresAt.getTime() - Date.now(),
      idleTime: Date.now() - session.lastAccessAt.getTime()
    };
  }
  
  /**
   * 更新索引
   */
  updateIndices(session, operation, oldData = {}) {
    const { id, type, data } = session;
    
    if (operation === 'add') {
      // 添加到类型索引
      if (!this.indices.byType.has(type)) {
        this.indices.byType.set(type, []);
      }
      this.indices.byType.get(type).push(id);
      
      // 添加到用户ID索引
      if (data.userId) {
        if (!this.indices.byUserId.has(data.userId)) {
          this.indices.byUserId.set(data.userId, []);
        }
        this.indices.byUserId.get(data.userId).push(id);
      }
      
      // 添加到连接ID索引
      if (data.connectionId) {
        this.indices.byConnectionId.set(data.connectionId, id);
      }
    } else if (operation === 'update') {
      // 更新用户ID索引
      if (oldData.userId !== data.userId) {
        // 从旧索引中移除
        if (oldData.userId) {
          const userSessions = this.indices.byUserId.get(oldData.userId) || [];
          const index = userSessions.indexOf(id);
          if (index > -1) {
            userSessions.splice(index, 1);
          }
        }
        
        // 添加到新索引
        if (data.userId) {
          if (!this.indices.byUserId.has(data.userId)) {
            this.indices.byUserId.set(data.userId, []);
          }
          this.indices.byUserId.get(data.userId).push(id);
        }
      }
      
      // 更新连接ID索引
      if (oldData.connectionId !== data.connectionId) {
        if (oldData.connectionId) {
          this.indices.byConnectionId.delete(oldData.connectionId);
        }
        if (data.connectionId) {
          this.indices.byConnectionId.set(data.connectionId, id);
        }
      }
    } else if (operation === 'remove') {
      // 从类型索引中移除
      const typeSessions = this.indices.byType.get(type) || [];
      const typeIndex = typeSessions.indexOf(id);
      if (typeIndex > -1) {
        typeSessions.splice(typeIndex, 1);
      }
      
      // 从用户ID索引中移除
      if (data.userId) {
        const userSessions = this.indices.byUserId.get(data.userId) || [];
        const userIndex = userSessions.indexOf(id);
        if (userIndex > -1) {
          userSessions.splice(userIndex, 1);
        }
      }
      
      // 从连接ID索引中移除
      if (data.connectionId) {
        this.indices.byConnectionId.delete(data.connectionId);
      }
    }
  }
  
  /**
   * 启动自动清理
   */
  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.cleanupSessions();
      }
    }, this.config.cleanupInterval);
    
    this.logger.info('Session cleanup started', {
      interval: this.config.cleanupInterval
    });
  }
  
  /**
   * 停止自动清理
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.logger.info('Session cleanup stopped');
  }
  
  /**
   * 保存会话到文件
   */
  async saveSessions() {
    if (!this.config.enablePersistence) {
      return;
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const sessionsData = {
        sessions: Array.from(this.sessions.values()).map(session => session.toJSON()),
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      const dir = path.dirname(this.config.persistenceFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.config.persistenceFile, JSON.stringify(sessionsData, null, 2));
      
      this.logger.debug('Sessions saved to file', {
        file: this.config.persistenceFile,
        count: this.sessions.size
      });
    } catch (error) {
      this.logger.error('Failed to save sessions', {}, error);
    }
  }
  
  /**
   * 从文件加载会话
   */
  async loadSessions() {
    if (!this.config.enablePersistence) {
      return;
    }
    
    try {
      const fs = await import('fs');
      
      if (!fs.existsSync(this.config.persistenceFile)) {
        this.logger.info('No persistence file found, starting with empty sessions');
        return;
      }
      
      const data = fs.readFileSync(this.config.persistenceFile, 'utf8');
      const sessionsData = JSON.parse(data);
      
      let loadedCount = 0;
      for (const sessionJson of sessionsData.sessions || []) {
        try {
          const session = Session.fromJSON(sessionJson);
          
          // 检查会话是否已过期
          if (!session.isExpired()) {
            this.sessions.set(session.id, session);
            this.updateIndices(session, 'add');
            loadedCount++;
          }
        } catch (error) {
          this.logger.warn('Failed to load session', { sessionId: sessionJson.id }, error);
        }
      }
      
      this.logger.info('Sessions loaded from file', {
        file: this.config.persistenceFile,
        loaded: loadedCount,
        total: sessionsData.sessions?.length || 0
      });
    } catch (error) {
      this.logger.error('Failed to load sessions', {}, error);
    }
  }
  
  /**
   * 关闭会话管理器
   */
  async shutdown() {
    this.isShuttingDown = true;
    
    // 停止清理定时器
    this.stopCleanup();
    
    // 保存会话数据
    if (this.config.enablePersistence) {
      await this.saveSessions();
    }
    
    // 清理所有会话
    const sessionCount = this.sessions.size;
    this.sessions.clear();
    
    // 清理索引
    this.indices.byUserId.clear();
    this.indices.byConnectionId.clear();
    this.indices.byType.clear();
    
    this.logger.info('SessionManager shutdown completed', {
      clearedSessions: sessionCount
    });
  }
}

// 导出
export {
  SessionManager,
  Session,
  SessionMetrics,
  SESSION_STATUS,
  SESSION_TYPE,
  DEFAULT_CONFIG
};

export default SessionManager;