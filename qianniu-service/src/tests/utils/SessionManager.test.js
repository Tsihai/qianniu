/**
 * SessionManager 单元测试
 * 测试统一会话管理器的各项功能
 */

const { SessionManager, Session, SESSION_STATUS, SESSION_TYPE } = require('../../utils/SessionManager');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  maxSessions: 100,
  sessionTimeout: 5000, // 5秒用于测试
  cleanupInterval: 1000, // 1秒清理间隔
  maxIdleTime: 2000,     // 2秒空闲时间
  enablePersistence: false,
  enableMetrics: true
};

const TEST_PERSISTENCE_CONFIG = {
  ...TEST_CONFIG,
  enablePersistence: true,
  persistenceFile: './test-sessions.json'
};

describe('Session', () => {
  let session;
  
  beforeEach(() => {
    session = new Session('test-session-1', SESSION_TYPE.WEBSOCKET, {
      userId: 'user123',
      connectionId: 'conn456'
    });
  });
  
  describe('创建和基本属性', () => {
    test('应该正确创建会话实例', () => {
      expect(session.id).toBe('test-session-1');
      expect(session.type).toBe(SESSION_TYPE.WEBSOCKET);
      expect(session.status).toBe(SESSION_STATUS.ACTIVE);
      expect(session.data.userId).toBe('user123');
      expect(session.data.connectionId).toBe('conn456');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.metadata.accessCount).toBe(0);
    });
    
    test('应该正确设置过期时间', () => {
      const now = Date.now();
      expect(session.expiresAt.getTime()).toBeGreaterThan(now);
    });
  });
  
  describe('会话操作', () => {
    test('应该正确更新会话数据', () => {
      const initialUpdatedAt = session.updatedAt;
      
      // 等待一毫秒确保时间差异
      setTimeout(() => {
        session.update({ newField: 'newValue' });
        
        expect(session.data.newField).toBe('newValue');
        expect(session.data.userId).toBe('user123'); // 原有数据保持
        expect(session.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
        expect(session.metadata.accessCount).toBe(1);
        expect(session.metadata.dataSize).toBeGreaterThan(0);
      }, 1);
    });
    
    test('应该正确处理会话访问', () => {
      const initialAccessCount = session.metadata.accessCount;
      const initialLastAccess = session.lastAccessAt;
      
      setTimeout(() => {
        session.access();
        
        expect(session.metadata.accessCount).toBe(initialAccessCount + 1);
        expect(session.lastAccessAt.getTime()).toBeGreaterThan(initialLastAccess.getTime());
      }, 1);
    });
    
    test('应该正确检测会话过期', () => {
      // 设置已过期的时间
      session.expiresAt = new Date(Date.now() - 1000);
      expect(session.isExpired()).toBe(true);
      
      // 设置未过期的时间
      session.expiresAt = new Date(Date.now() + 1000);
      expect(session.isExpired()).toBe(false);
    });
    
    test('应该正确检测会话空闲', () => {
      // 设置空闲时间
      session.lastAccessAt = new Date(Date.now() - 3000);
      expect(session.isIdle(2000)).toBe(true);
      
      // 设置活跃时间
      session.lastAccessAt = new Date(Date.now() - 1000);
      expect(session.isIdle(2000)).toBe(false);
    });
    
    test('应该正确标记会话状态', () => {
      session.expire();
      expect(session.status).toBe(SESSION_STATUS.EXPIRED);
      
      session.terminate();
      expect(session.status).toBe(SESSION_STATUS.TERMINATED);
    });
  });
  
  describe('序列化和反序列化', () => {
    test('应该正确序列化会话', () => {
      const json = session.toJSON();
      
      expect(json.id).toBe(session.id);
      expect(json.type).toBe(session.type);
      expect(json.status).toBe(session.status);
      expect(json.data).toEqual(session.data);
      expect(json.createdAt).toBe(session.createdAt.toISOString());
      expect(json.metadata).toEqual(session.metadata);
    });
    
    test('应该正确反序列化会话', () => {
      const json = session.toJSON();
      const restored = Session.fromJSON(json);
      
      expect(restored.id).toBe(session.id);
      expect(restored.type).toBe(session.type);
      expect(restored.status).toBe(session.status);
      expect(restored.data).toEqual(session.data);
      expect(restored.createdAt.getTime()).toBe(session.createdAt.getTime());
      expect(restored.metadata).toEqual(session.metadata);
    });
  });
});

describe('SessionManager', () => {
  let sessionManager;
  
  beforeEach(() => {
    sessionManager = new SessionManager(TEST_CONFIG);
  });
  
  afterEach(() => {
    sessionManager.shutdown();
  });
  
  describe('初始化和配置', () => {
    test('应该正确初始化会话管理器', () => {
      expect(sessionManager.config.maxSessions).toBe(TEST_CONFIG.maxSessions);
      expect(sessionManager.config.sessionTimeout).toBe(TEST_CONFIG.sessionTimeout);
      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager.cleanupTimer).toBeTruthy();
    });
    
    test('应该使用默认配置', () => {
      const defaultManager = new SessionManager();
      expect(defaultManager.config.maxSessions).toBe(10000);
      expect(defaultManager.config.sessionTimeout).toBe(30 * 60 * 1000);
      defaultManager.shutdown();
    });
  });
  
  describe('会话创建', () => {
    test('应该成功创建会话', () => {
      const session = sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, {
        userId: 'user1',
        connectionId: 'conn1'
      });
      
      expect(session).toBeInstanceOf(Session);
      expect(session.id).toBe('session1');
      expect(session.type).toBe(SESSION_TYPE.WEBSOCKET);
      expect(sessionManager.sessions.size).toBe(1);
    });
    
    test('应该触发会话创建事件', (done) => {
      sessionManager.on('sessionCreated', (session) => {
        expect(session.id).toBe('session1');
        done();
      });
      
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
    });
    
    test('应该拒绝创建重复ID的会话', () => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      
      expect(() => {
        sessionManager.createSession('session1', SESSION_TYPE.MESSAGE);
      }).toThrow('Session with id session1 already exists');
    });
    
    test('应该在达到最大会话数时拒绝创建', () => {
      const smallManager = new SessionManager({ maxSessions: 2 });
      
      smallManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      smallManager.createSession('session2', SESSION_TYPE.WEBSOCKET);
      
      expect(() => {
        smallManager.createSession('session3', SESSION_TYPE.WEBSOCKET);
      }).toThrow('Maximum sessions limit (2) reached');
      
      smallManager.shutdown();
    });
  });
  
  describe('会话查询', () => {
    beforeEach(() => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, {
        userId: 'user1',
        connectionId: 'conn1'
      });
      sessionManager.createSession('session2', SESSION_TYPE.MESSAGE, {
        userId: 'user1',
        connectionId: 'conn2'
      });
      sessionManager.createSession('session3', SESSION_TYPE.BUSINESS, {
        userId: 'user2',
        connectionId: 'conn3'
      });
    });
    
    test('应该正确获取会话', () => {
      const session = sessionManager.getSession('session1');
      expect(session).toBeTruthy();
      expect(session.id).toBe('session1');
      expect(session.metadata.accessCount).toBe(1); // 访问计数增加
    });
    
    test('应该返回null对于不存在的会话', () => {
      const session = sessionManager.getSession('nonexistent');
      expect(session).toBeNull();
    });
    
    test('应该根据用户ID获取会话', () => {
      const sessions = sessionManager.getSessionByUserId('user1');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain('session1');
      expect(sessions.map(s => s.id)).toContain('session2');
    });
    
    test('应该根据连接ID获取会话', () => {
      const session = sessionManager.getSessionByConnectionId('conn1');
      expect(session).toBeTruthy();
      expect(session.id).toBe('session1');
    });
    
    test('应该根据类型获取会话', () => {
      const sessions = sessionManager.getSessionsByType(SESSION_TYPE.WEBSOCKET);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session1');
    });
    
    test('应该获取所有会话', () => {
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(3);
    });
  });
  
  describe('会话更新', () => {
    beforeEach(() => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, {
        userId: 'user1',
        connectionId: 'conn1'
      });
    });
    
    test('应该成功更新会话数据', () => {
      const session = sessionManager.updateSession('session1', {
        newField: 'newValue',
        userId: 'user1-updated'
      });
      
      expect(session.data.newField).toBe('newValue');
      expect(session.data.userId).toBe('user1-updated');
      expect(session.metadata.accessCount).toBeGreaterThan(0);
    });
    
    test('应该触发会话更新事件', (done) => {
      sessionManager.on('sessionUpdated', (session, oldData) => {
        expect(session.id).toBe('session1');
        expect(oldData.userId).toBe('user1');
        expect(session.data.userId).toBe('user1-updated');
        done();
      });
      
      sessionManager.updateSession('session1', { userId: 'user1-updated' });
    });
    
    test('应该在会话不存在时抛出错误', () => {
      expect(() => {
        sessionManager.updateSession('nonexistent', { data: 'value' });
      }).toThrow('Session nonexistent not found');
    });
    
    test('应该正确更新索引', () => {
      // 更新用户ID
      sessionManager.updateSession('session1', { userId: 'user1-new' });
      
      // 旧用户ID应该没有会话
      expect(sessionManager.getSessionByUserId('user1')).toHaveLength(0);
      
      // 新用户ID应该有会话
      expect(sessionManager.getSessionByUserId('user1-new')).toHaveLength(1);
    });
  });
  
  describe('会话删除', () => {
    beforeEach(() => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, {
        userId: 'user1',
        connectionId: 'conn1'
      });
    });
    
    test('应该成功删除会话', () => {
      const result = sessionManager.deleteSession('session1');
      
      expect(result).toBe(true);
      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager.getSession('session1')).toBeNull();
    });
    
    test('应该触发会话删除事件', (done) => {
      sessionManager.on('sessionDeleted', (session) => {
        expect(session.id).toBe('session1');
        expect(session.status).toBe(SESSION_STATUS.TERMINATED);
        done();
      });
      
      sessionManager.deleteSession('session1');
    });
    
    test('应该在会话不存在时返回false', () => {
      const result = sessionManager.deleteSession('nonexistent');
      expect(result).toBe(false);
    });
    
    test('应该正确清理索引', () => {
      sessionManager.deleteSession('session1');
      
      expect(sessionManager.getSessionByUserId('user1')).toHaveLength(0);
      expect(sessionManager.getSessionByConnectionId('conn1')).toBeNull();
    });
  });
  
  describe('会话清理', () => {
    test('应该清理过期会话', (done) => {
      // 创建会话
      const session = sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      
      // 手动设置为过期
      session.expiresAt = new Date(Date.now() - 1000);
      
      sessionManager.on('sessionExpired', (expiredSession) => {
        expect(expiredSession.id).toBe('session1');
        expect(sessionManager.sessions.size).toBe(0);
        done();
      });
      
      sessionManager.cleanupSessions();
    });
    
    test('应该标记空闲会话', (done) => {
      // 创建会话
      const session = sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      
      // 手动设置为空闲
      session.lastAccessAt = new Date(Date.now() - 3000);
      
      sessionManager.on('sessionIdle', (idleSession) => {
        expect(idleSession.id).toBe('session1');
        expect(idleSession.status).toBe(SESSION_STATUS.IDLE);
        done();
      });
      
      sessionManager.cleanupSessions();
    });
    
    test('应该返回清理统计信息', () => {
      // 创建过期会话
      const expiredSession = sessionManager.createSession('expired', SESSION_TYPE.WEBSOCKET);
      expiredSession.expiresAt = new Date(Date.now() - 1000);
      
      // 创建空闲会话
      const idleSession = sessionManager.createSession('idle', SESSION_TYPE.WEBSOCKET);
      idleSession.lastAccessAt = new Date(Date.now() - 3000);
      
      // 创建正常会话
      sessionManager.createSession('active', SESSION_TYPE.WEBSOCKET);
      
      const result = sessionManager.cleanupSessions();
      
      expect(result.expired).toBe(1);
      expect(result.idle).toBe(1);
      expect(result.total).toBe(2); // 过期的被删除，空闲的保留
    });
  });
  
  describe('统计信息', () => {
    beforeEach(() => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, { userId: 'user1' });
      sessionManager.createSession('session2', SESSION_TYPE.MESSAGE, { userId: 'user2' });
      sessionManager.createSession('session3', SESSION_TYPE.BUSINESS, { userId: 'user3' });
    });
    
    test('应该正确计算统计信息', () => {
      const metrics = sessionManager.getMetrics();
      
      expect(metrics.totalSessions).toBe(3);
      expect(metrics.activeSessions).toBe(3);
      expect(metrics.sessionsByType[SESSION_TYPE.WEBSOCKET]).toBe(1);
      expect(metrics.sessionsByType[SESSION_TYPE.MESSAGE]).toBe(1);
      expect(metrics.sessionsByType[SESSION_TYPE.BUSINESS]).toBe(1);
      expect(metrics.totalCreated).toBe(3);
    });
    
    test('应该正确计算内存使用', () => {
      const metrics = sessionManager.getMetrics();
      
      expect(metrics.memoryUsage).toBeGreaterThan(0);
      expect(metrics.averageSessionSize).toBeGreaterThan(0);
    });
  });
  
  describe('会话详情', () => {
    test('应该返回详细的会话信息', () => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET, { userId: 'user1' });
      
      const detail = sessionManager.getSessionDetail('session1');
      
      expect(detail).toBeTruthy();
      expect(detail.id).toBe('session1');
      expect(detail.isExpired).toBe(false);
      expect(detail.isIdle).toBe(false);
      expect(detail.timeToExpire).toBeGreaterThan(0);
      expect(detail.idleTime).toBeGreaterThanOrEqual(0);
    });
    
    test('应该在会话不存在时返回null', () => {
      const detail = sessionManager.getSessionDetail('nonexistent');
      expect(detail).toBeNull();
    });
  });
  
  describe('持久化', () => {
    let persistenceManager;
    const testFile = './test-sessions.json';
    
    beforeEach(() => {
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      
      persistenceManager = new SessionManager(TEST_PERSISTENCE_CONFIG);
    });
    
    afterEach(() => {
      persistenceManager.shutdown();
      
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    test('应该保存会话到文件', () => {
      persistenceManager.createSession('session1', SESSION_TYPE.WEBSOCKET, { userId: 'user1' });
      persistenceManager.saveSessions();
      
      expect(fs.existsSync(testFile)).toBe(true);
      
      const data = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe('session1');
    });
    
    test('应该从文件加载会话', () => {
      // 创建测试数据
      const testData = {
        sessions: [{
          id: 'session1',
          type: SESSION_TYPE.WEBSOCKET,
          status: SESSION_STATUS.ACTIVE,
          data: { userId: 'user1' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          metadata: { accessCount: 0, dataSize: 0 }
        }],
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      fs.writeFileSync(testFile, JSON.stringify(testData));
      
      // 创建新的管理器加载数据
      const newManager = new SessionManager(TEST_PERSISTENCE_CONFIG);
      
      expect(newManager.sessions.size).toBe(1);
      expect(newManager.getSession('session1')).toBeTruthy();
      
      newManager.shutdown();
    });
    
    test('应该跳过过期的会话', () => {
      // 创建过期的测试数据
      const testData = {
        sessions: [{
          id: 'expired-session',
          type: SESSION_TYPE.WEBSOCKET,
          status: SESSION_STATUS.ACTIVE,
          data: { userId: 'user1' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(), // 已过期
          metadata: { accessCount: 0, dataSize: 0 }
        }],
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      fs.writeFileSync(testFile, JSON.stringify(testData));
      
      const newManager = new SessionManager(TEST_PERSISTENCE_CONFIG);
      
      expect(newManager.sessions.size).toBe(0);
      
      newManager.shutdown();
    });
  });
  
  describe('生命周期管理', () => {
    test('应该正确启动和停止清理', () => {
      expect(sessionManager.cleanupTimer).toBeTruthy();
      
      sessionManager.stopCleanup();
      expect(sessionManager.cleanupTimer).toBeNull();
      
      sessionManager.startCleanup();
      expect(sessionManager.cleanupTimer).toBeTruthy();
    });
    
    test('应该正确关闭管理器', () => {
      sessionManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      
      const initialSize = sessionManager.sessions.size;
      expect(initialSize).toBeGreaterThan(0);
      
      sessionManager.shutdown();
      
      expect(sessionManager.isShuttingDown).toBe(true);
      expect(sessionManager.cleanupTimer).toBeNull();
      expect(sessionManager.sessions.size).toBe(0);
    });
  });
  
  describe('错误处理', () => {
    test('应该处理无效的会话操作', () => {
      expect(() => {
        sessionManager.updateSession('nonexistent', {});
      }).toThrow();
    });
    
    test('应该处理持久化错误', () => {
      const invalidManager = new SessionManager({
        enablePersistence: true,
        persistenceFile: '/invalid/path/sessions.json'
      });
      
      // 应该不会抛出错误，而是记录日志
      expect(() => {
        invalidManager.saveSessions();
      }).not.toThrow();
      
      invalidManager.shutdown();
    });
  });
  
  describe('自动清理集成测试', () => {
    test('应该自动清理过期会话', (done) => {
      const quickManager = new SessionManager({
        sessionTimeout: 100,  // 100ms过期
        cleanupInterval: 50   // 50ms清理间隔
      });
      
      quickManager.createSession('session1', SESSION_TYPE.WEBSOCKET);
      
      quickManager.on('sessionExpired', () => {
        expect(quickManager.sessions.size).toBe(0);
        quickManager.shutdown();
        done();
      });
    }, 1000);
  });
});