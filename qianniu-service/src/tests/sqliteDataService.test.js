const path = require('path');
const fs = require('fs').promises;
const SQLiteDataService = require('../services/sqliteDataService');
const { ConfigManager } = require('../config/ConfigManager');
const Logger = require('../utils/Logger');

// user context7

describe('SQLiteDataService', () => {
  let dataService;
  let configManager;
  let testDbPath;
  
  beforeAll(async () => {
    // 创建测试用的配置管理器
    configManager = new ConfigManager();
    await configManager.initialize();
    
    // 设置测试数据库路径
    testDbPath = path.join(__dirname, '../../data/test_qianniu.db');
    
    // 确保测试数据目录存在
    const dataDir = path.dirname(testDbPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
    }
    
    // 创建SQLiteDataService实例
    dataService = new SQLiteDataService({
      mockMode: false,
      database: {
        sqlite: {
          path: testDbPath,
          options: {
            timeout: 5000,
            verbose: false
          }
        }
      }
    });
    
    await dataService.initialize();
  });
  
  afterAll(async () => {
    // 清理测试数据库
    if (dataService) {
      await dataService.disconnect();
    }
    
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // 文件不存在，忽略错误
    }
  });
  
  beforeEach(async () => {
    // 每个测试前清理数据
    if (dataService && dataService.isConnected()) {
      await dataService.clearAllData();
    }
  });
  
  describe('初始化和连接', () => {
    test('应该成功初始化数据库', async () => {
      expect(dataService.isConnected()).toBe(true);
    });
    
    test('应该创建所有必要的表', async () => {
      const tables = await dataService.getAllTables();
      const expectedTables = [
        'customers', 'sessions', 'messages', 'intent_templates',
        'auto_replies', 'customer_behaviors', 'statistics',
        'global_statistics', 'hourly_statistics', 'daily_statistics',
        'intent_statistics', 'keyword_statistics', 'customer_profiles'
      ];
      
      expectedTables.forEach(table => {
        expect(tables).toContain(table);
      });
    });
  });
  
  describe('Customer操作', () => {
    const testCustomer = {
      customerId: 'test_customer_001',
      name: '测试客户',
      email: 'test@example.com',
      phone: '13800138000',
      tags: ['VIP', '重要客户'],
      metadata: { source: 'website', level: 'gold' }
    };
    
    test('应该成功创建客户', async () => {
      const customer = await dataService.Customer.create(testCustomer);
      
      expect(customer).toBeDefined();
      expect(customer.customerId).toBe(testCustomer.customerId);
      expect(customer.name).toBe(testCustomer.name);
      expect(customer.email).toBe(testCustomer.email);
    });
    
    test('应该根据ID查找客户', async () => {
      await dataService.Customer.create(testCustomer);
      
      const foundCustomer = await dataService.Customer.findById(testCustomer.customerId);
      
      expect(foundCustomer).toBeDefined();
      expect(foundCustomer.customerId).toBe(testCustomer.customerId);
      expect(foundCustomer.name).toBe(testCustomer.name);
    });
    
    test('应该更新客户信息', async () => {
      await dataService.Customer.create(testCustomer);
      
      const updatedData = {
        name: '更新后的客户名',
        phone: '13900139000'
      };
      
      const updatedCustomer = await dataService.Customer.findByIdAndUpdate(
        testCustomer.customerId,
        updatedData
      );
      
      expect(updatedCustomer.name).toBe(updatedData.name);
      expect(updatedCustomer.phone).toBe(updatedData.phone);
      expect(updatedCustomer.email).toBe(testCustomer.email); // 未更新的字段保持不变
    });
    
    test('应该删除客户', async () => {
      await dataService.Customer.create(testCustomer);
      
      await dataService.Customer.findByIdAndDelete(testCustomer.customerId);
      
      const deletedCustomer = await dataService.Customer.findById(testCustomer.customerId);
      expect(deletedCustomer).toBeNull();
    });
    
    test('应该查找所有客户', async () => {
      const customers = [
        { ...testCustomer, customerId: 'customer_001' },
        { ...testCustomer, customerId: 'customer_002', name: '客户2' },
        { ...testCustomer, customerId: 'customer_003', name: '客户3' }
      ];
      
      for (const customer of customers) {
        await dataService.Customer.create(customer);
      }
      
      const allCustomers = await dataService.Customer.find({});
      expect(allCustomers).toHaveLength(3);
    });
  });
  
  describe('Session操作', () => {
    const testSession = {
      sessionId: 'test_session_001',
      customerId: 'test_customer_001',
      status: 'active',
      startTime: new Date(),
      metadata: { channel: 'web', agent: 'auto' }
    };
    
    beforeEach(async () => {
      // 创建测试客户
      await dataService.Customer.create({
        customerId: 'test_customer_001',
        name: '测试客户',
        email: 'test@example.com'
      });
    });
    
    test('应该成功创建会话', async () => {
      const session = await dataService.Session.create(testSession);
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(testSession.sessionId);
      expect(session.customerId).toBe(testSession.customerId);
      expect(session.status).toBe(testSession.status);
    });
    
    test('应该根据ID查找会话', async () => {
      await dataService.Session.create(testSession);
      
      const foundSession = await dataService.Session.findById(testSession.sessionId);
      
      expect(foundSession).toBeDefined();
      expect(foundSession.sessionId).toBe(testSession.sessionId);
    });
    
    test('应该根据客户ID查找会话', async () => {
      await dataService.Session.create(testSession);
      await dataService.Session.create({
        ...testSession,
        sessionId: 'test_session_002'
      });
      
      const customerSessions = await dataService.Session.find({
        customerId: testSession.customerId
      });
      
      expect(customerSessions).toHaveLength(2);
      customerSessions.forEach(session => {
        expect(session.customerId).toBe(testSession.customerId);
      });
    });
    
    test('应该更新会话状态', async () => {
      await dataService.Session.create(testSession);
      
      const updatedSession = await dataService.Session.findByIdAndUpdate(
        testSession.sessionId,
        { status: 'closed', endTime: new Date() }
      );
      
      expect(updatedSession.status).toBe('closed');
      expect(updatedSession.endTime).toBeDefined();
    });
  });
  
  describe('IntentTemplate操作', () => {
    const testTemplate = {
      intent: 'greeting',
      keywords: ['你好', '您好', 'hello'],
      responses: ['您好！有什么可以帮助您的吗？', '欢迎咨询！'],
      confidence: 0.9,
      category: 'common',
      isActive: true
    };
    
    test('应该成功创建意图模板', async () => {
      const template = await dataService.IntentTemplate.create(testTemplate);
      
      expect(template).toBeDefined();
      expect(template.intent).toBe(testTemplate.intent);
      expect(template.keywords).toEqual(testTemplate.keywords);
      expect(template.responses).toEqual(testTemplate.responses);
    });
    
    test('应该查找所有活跃的意图模板', async () => {
      await dataService.IntentTemplate.create(testTemplate);
      await dataService.IntentTemplate.create({
        ...testTemplate,
        intent: 'farewell',
        keywords: ['再见', 'bye'],
        isActive: false
      });
      
      const activeTemplates = await dataService.IntentTemplate.find({ isActive: true });
      const allTemplates = await dataService.IntentTemplate.find({});
      
      expect(activeTemplates).toHaveLength(1);
      expect(allTemplates).toHaveLength(2);
      expect(activeTemplates[0].intent).toBe('greeting');
    });
    
    test('应该根据意图查找模板', async () => {
      await dataService.IntentTemplate.create(testTemplate);
      
      const template = await dataService.IntentTemplate.findOne({ intent: 'greeting' });
      
      expect(template).toBeDefined();
      expect(template.intent).toBe('greeting');
    });
  });
  
  describe('Mock模式', () => {
    let mockDataService;
    
    beforeAll(() => {
      mockDataService = new SQLiteDataService({
        mockMode: true
      });
    });
    
    test('Mock模式应该返回模拟数据', async () => {
      const customer = await mockDataService.Customer.create({
        customerId: 'mock_customer',
        name: 'Mock Customer'
      });
      
      expect(customer).toBeDefined();
      expect(customer.customerId).toBe('mock_customer');
      expect(customer.name).toBe('Mock Customer');
    });
    
    test('Mock模式的查找操作应该正常工作', async () => {
      const foundCustomer = await mockDataService.Customer.findById('mock_customer');
      expect(foundCustomer).toBeDefined();
    });
  });
  
  describe('错误处理', () => {
    test('应该处理重复的客户ID', async () => {
      const customer = {
        customerId: 'duplicate_customer',
        name: '重复客户',
        email: 'duplicate@example.com'
      };
      
      await dataService.Customer.create(customer);
      
      // 尝试创建相同ID的客户应该抛出错误
      await expect(dataService.Customer.create(customer))
        .rejects.toThrow();
    });
    
    test('应该处理不存在的客户查找', async () => {
      const nonExistentCustomer = await dataService.Customer.findById('non_existent_id');
      expect(nonExistentCustomer).toBeNull();
    });
    
    test('应该处理无效的数据格式', async () => {
      await expect(dataService.Customer.create({
        // 缺少必需的customerId字段
        name: '无效客户'
      })).rejects.toThrow();
    });
  });
  
  describe('性能测试', () => {
    test('批量插入客户应该在合理时间内完成', async () => {
      const startTime = Date.now();
      const customers = [];
      
      // 创建100个测试客户
      for (let i = 0; i < 100; i++) {
        customers.push({
          customerId: `perf_customer_${i}`,
          name: `性能测试客户${i}`,
          email: `perf${i}@example.com`
        });
      }
      
      // 批量插入
      for (const customer of customers) {
        await dataService.Customer.create(customer);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100个客户的插入应该在5秒内完成
      expect(duration).toBeLessThan(5000);
      
      // 验证所有客户都已插入
      const allCustomers = await dataService.Customer.find({});
      expect(allCustomers.length).toBeGreaterThanOrEqual(100);
    }, 10000); // 设置较长的超时时间
  });
});