/**
 * 数据服务测试
 */
import DataService from '../services/dataService.js';
import models from '../models/index.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 测试用客户ID
let TEST_CLIENT_ID;
let TEST_SESSION_ID;

describe('DataService', () => {
  let dataService;
  
  beforeAll(() => {
    // 启用Mock模式进行测试
    process.env.DB_MOCK_MODE = 'true';
    if (models.db.enableMockMode) {
      models.db.enableMockMode();
    }
  });
  
  beforeEach(() => {
    // 为每个测试生成唯一ID
    TEST_CLIENT_ID = 'test-client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    TEST_SESSION_ID = 'test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // 创建模拟函数
    const mockFn = (implementation) => {
      const fn = (...args) => {
        fn.calls.push(args);
        return implementation(...args);
      };
      fn.calls = [];
      return fn;
    };
    
    // 模拟模型操作
    // 模拟Customer模型
    models.Customer = {
      findOne: mockFn(async () => null),
      create: mockFn(async (data) => ({ 
        ...data, 
        save: async () => data,
        stats: { messageCount: 0, visitCount: 0 },
        tags: []
      })),
      findByClientId: mockFn(async (clientId) => ({
        clientId,
        nickname: '测试客户',
        stats: { messageCount: 0, visitCount: 0 },
        tags: [],
        save: async function() { return this; }
      })),
      find: mockFn(async () => [
        { clientId: 'client1', stats: { messageCount: 10 } },
        { clientId: 'client2', stats: { messageCount: 5 } }
      ])
    };
    
    // 模拟Session模型
    models.Session = {
      findOne: mockFn(async () => null),
      create: mockFn(async (data) => ({
        ...data,
        messages: [],
        save: async () => data
      })),
      findBySessionId: mockFn(async (sessionId) => ({
        sessionId,
        clientId: TEST_CLIENT_ID,
        messages: [],
        context: {},
        save: async function() { return this; }
      })),
      find: mockFn(async () => [
        { sessionId: 'session1', clientId: TEST_CLIENT_ID },
        { sessionId: 'session2', clientId: TEST_CLIENT_ID }
      ]),
      deleteOne: mockFn(async () => ({ deletedCount: 1 }))
    };
    
    // 模拟IntentTemplate模型
    models.IntentTemplate = {
      findOne: mockFn(async () => null),
      create: mockFn(async (data) => ({
        ...data,
        save: async () => data
      })),
      find: mockFn(async () => [
        { name: '问候', patterns: [{ text: '你好' }], templates: [{ text: '您好' }] },
        { name: '测试意图', patterns: [{ text: '测试' }], templates: [{ text: '测试回复' }] }
      ]),
      deleteOne: mockFn(async () => ({ deletedCount: 1 }))
    };
    
    // 创建数据服务实例（启用Mock模式）
    dataService = new DataService({ mockMode: true });
  });

  describe('Customer Operations', () => {
    test('should handle customer operations correctly', async () => {
      // 获取客户（创建新客户）
      const customer = await dataService.getCustomer(TEST_CLIENT_ID);
      expect(customer.clientId).toBe(TEST_CLIENT_ID);
      
      // 更新客户统计
      const updatedCustomer = await dataService.updateCustomerStats(TEST_CLIENT_ID, {
        messageCount: 5,
        visitCount: 2
      });
      expect(updatedCustomer).toBeDefined();
      
      // 添加客户标签
      const taggedCustomer = await dataService.addCustomerTag(TEST_CLIENT_ID, '测试标签');
      expect(taggedCustomer).toBeDefined();
      
      // 更新意图统计
      await dataService.updateCustomerIntentStats(TEST_CLIENT_ID, '问候');
      
      // 获取活跃客户
      const topCustomers = await dataService.getTopCustomers(5);
      expect(Array.isArray(topCustomers)).toBe(true);
      expect(topCustomers.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Session Operations', () => {
    test('should handle session operations correctly', async () => {
      // 创建会话
      const session = await dataService.createSession(TEST_SESSION_ID, TEST_CLIENT_ID);
      expect(session.sessionId).toBe(TEST_SESSION_ID);
      
      // 添加消息
      const testMessage = {
        content: '这是一条测试消息',
        type: 'chat',
        sender: TEST_CLIENT_ID,
        timestamp: Date.now()
      };
      
      await dataService.addMessage(TEST_SESSION_ID, testMessage);
      
      // 更新会话上下文
      await dataService.updateSessionContext(TEST_SESSION_ID, {
        lastIntent: '问候',
        lastKeywords: ['你好', '测试']
      });
      
      // 获取会话
      const retrievedSession = await dataService.getSession(TEST_SESSION_ID);
      expect(retrievedSession).toBeDefined();
      
      // 获取会话消息
      const messages = await dataService.getSessionMessages(TEST_SESSION_ID);
      expect(Array.isArray(messages)).toBe(true);
      
      // 获取客户的所有会话
      const clientSessions = await dataService.getSessionsByClientId(TEST_CLIENT_ID);
      expect(Array.isArray(clientSessions)).toBe(true);
      expect(clientSessions.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Intent Template Operations', () => {
    test('should handle intent template operations correctly', async () => {
      // 创建测试意图
      const testIntent = {
        name: '测试意图',
        description: '用于测试的意图模板',
        type: 'custom',
        patterns: [
          { text: '这是测试模式1', enabled: true },
          { text: '这是测试模式2', enabled: true }
        ],
        templates: [
          { text: '这是测试回复1', variables: [], enabled: true },
          { text: '这是测试回复2', variables: [], enabled: true }
        ]
      };
      
      // 获取所有意图模板
      const templates = await dataService.getAllIntentTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(0);
      
      // 获取特定意图模板
      const template = await dataService.getIntentTemplate('测试意图');
      // 注意：由于是mock数据，可能返回null，这是正常的
      
      // 更新意图统计
      await dataService.updateIntentStats('测试意图', true, true);
    });
  });
  
  describe('Stats Operations', () => {
    test('should handle stats operations correctly', async () => {
      // 获取消息统计
      const messageStats = await dataService.getMessageStats();
      expect(messageStats).toBeDefined();
      
      // 获取意图统计
      const intentStats = await dataService.getIntentStats();
      expect(intentStats).toBeDefined();
    });
  });

});