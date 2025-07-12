/**
 * 业务逻辑处理器测试
 */
const BusinessLogicProcessor = require('../services/businessLogic');
const AutoReplyStrategy = require('../services/businessLogic/strategies/AutoReplyStrategy');
const StatisticsStrategy = require('../services/businessLogic/strategies/StatisticsStrategy');
const CustomerBehaviorStrategy = require('../services/businessLogic/strategies/CustomerBehaviorStrategy');

describe('BusinessLogicProcessor', () => {
  let businessLogicProcessor;
  let mockMessageProcessor;
  let mockWsService;
  
  beforeEach(() => {
    // 模拟消息处理器
    mockMessageProcessor = {
      parseMessage: jest.fn((message) => ({
        cleanContent: message.content,
        keywords: message.content.split(' ')
      })),
      classifyIntent: jest.fn(() => [{
        intent: '询问价格',
        confidence: 0.85
      }]),
      generateReply: jest.fn(() => ({
        text: '这款产品的价格是99元，现在购买还有优惠活动哦！',
        confidence: 0.85,
        intent: '询问价格'
      })),
      handleSession: jest.fn()
    };

    // 模拟WebSocket服务
    mockWsService = {
      on: jest.fn(),
      emit: jest.fn(),
      send: jest.fn()
    };

    // 模拟性能监控器
    const mockPerformanceMonitor = {
      start: jest.fn(),
      stop: jest.fn(),
      startTimer: jest.fn(() => ({
        end: jest.fn()
      })),
      recordMetric: jest.fn(),
      getMetrics: jest.fn(() => ({})),
      reset: jest.fn()
    };

    // 模拟错误处理器
    const mockErrorHandler = {
      handleError: jest.fn(),
      logError: jest.fn(),
      handle: jest.fn((error) => {
        console.error('Mock ErrorHandler handle:', error);
        return error;
      })
    };

    // 模拟会话管理器
    const mockSessions = new Map();
    const mockSessionManager = {
      sessions: mockSessions,
      createSession: jest.fn((clientId, sessionType = 'default') => {
        const session = {
          id: clientId,
          type: sessionType,
          createdAt: new Date(),
          lastAccessAt: new Date(),
          data: {
            id: clientId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0,
            history: [],
            customerInfo: {},
            statistics: {}
          }
        };
        mockSessions.set(clientId, session);
        return session;
      }),
      getSession: jest.fn((clientId) => {
        return mockSessions.get(clientId) || null;
      }),
      updateSession: jest.fn((clientId, updateData) => {
        const session = mockSessions.get(clientId);
        if (session) {
          Object.assign(session.data, updateData);
          session.lastAccessAt = new Date();
        }
        return session;
      }),
      deleteSession: jest.fn((clientId) => {
        return mockSessions.delete(clientId);
      }),
      getAllSessions: jest.fn(() => {
        return Array.from(mockSessions.values());
      })
    };

    // 模拟数据服务
    const mockDataService = {
      // Customer相关方法
      getCustomer: jest.fn().mockResolvedValue(null),
      createCustomer: jest.fn().mockResolvedValue({ id: 'customer1', name: 'Test Customer' }),
      updateCustomer: jest.fn().mockResolvedValue({ id: 'customer1', name: 'Updated Customer' }),
      getAllCustomers: jest.fn().mockResolvedValue([]),
      
      // IntentTemplate相关方法
      getAllIntentTemplates: jest.fn().mockResolvedValue([]),
      getIntentTemplate: jest.fn().mockResolvedValue(null),
      createIntentTemplate: jest.fn().mockResolvedValue({ id: 'template1', intent: 'greeting' }),
      updateIntentTemplate: jest.fn().mockResolvedValue({ id: 'template1', intent: 'greeting' }),
      deleteIntentTemplate: jest.fn().mockResolvedValue(true),
      
      // Statistics相关方法
      getStatistics: jest.fn().mockResolvedValue([]),
      saveStatistics: jest.fn().mockResolvedValue(true),
      
      // Session相关方法
      createSession: jest.fn().mockResolvedValue({ id: 'session1', clientId: 'client1' }),
      getSessionsByClientId: jest.fn().mockResolvedValue([])
    };

    // 创建业务逻辑处理器实例
    businessLogicProcessor = new BusinessLogicProcessor({
      messageProcessor: mockMessageProcessor,
      wsService: mockWsService,
      dataService: mockDataService,
      logger: console,
      errorHandler: mockErrorHandler,
      performanceMonitor: mockPerformanceMonitor,
      sessionManager: mockSessionManager,
      enableLogging: false, // 禁用日志以减少测试输出
      statisticsOptions: {
        saveInterval: 0 // 禁用定时保存
      },
      customerBehaviorOptions: {
        saveInterval: 0 // 禁用定时保存
      }
    });
    
    // 添加错误事件监听器以防止未处理的错误
    businessLogicProcessor.on('error', () => {
      // 静默处理错误事件，防止测试中断
    });
  });
  
  afterEach(() => {
    // 清理事件监听器
    if (businessLogicProcessor) {
      businessLogicProcessor.removeAllListeners();
      
      // 清理会话 - 清理mock会话数据
      if (businessLogicProcessor.sessionManager && businessLogicProcessor.sessionManager.sessions) {
        businessLogicProcessor.sessionManager.sessions.clear();
      }
      
      // 清理策略中的定时器
      if (businessLogicProcessor.strategies.statistics && businessLogicProcessor.strategies.statistics.saveIntervalId) {
        clearInterval(businessLogicProcessor.strategies.statistics.saveIntervalId);
        businessLogicProcessor.strategies.statistics.saveIntervalId = null;
      }
      if (businessLogicProcessor.strategies.customerBehavior && businessLogicProcessor.strategies.customerBehavior.analysisIntervalId) {
        clearInterval(businessLogicProcessor.strategies.customerBehavior.analysisIntervalId);
      }
      if (businessLogicProcessor.strategies.autoReply && businessLogicProcessor.strategies.autoReply.cacheCleanupIntervalId) {
        clearInterval(businessLogicProcessor.strategies.autoReply.cacheCleanupIntervalId);
      }
    }
  });

  test('应该正确初始化策略处理器', () => {
    expect(businessLogicProcessor.strategies).toBeDefined();
    expect(businessLogicProcessor.strategies.autoReply).toBeInstanceOf(AutoReplyStrategy);
    expect(businessLogicProcessor.strategies.statistics).toBeInstanceOf(StatisticsStrategy);
    expect(businessLogicProcessor.strategies.customerBehavior).toBeInstanceOf(CustomerBehaviorStrategy);
    expect(Object.keys(businessLogicProcessor.strategies)).toHaveLength(3);
  });

  test('应该能够处理消息并返回业务结果', () => {
    const testMessage = {
      content: '你好，请问这个商品多少钱？',
      sender: 'user123',
      timestamp: Date.now()
    };

    const processedResult = {
      originalMessage: testMessage,
      parsedMessage: {
        cleanContent: testMessage.content,
        keywords: ['你好', '商品', '多少钱'],
        clientId: 'user123'
      },
      bestIntent: {
        intent: '询问价格',
        confidence: 0.85
      },
      intents: [{
        intent: '询问价格',
        confidence: 0.85
      }],
      timestamp: Date.now()
    };

    const businessResult = businessLogicProcessor.process(processedResult);
    
    expect(businessResult).toBeDefined();
    expect(businessResult.sessionId).toBe('user123');
    expect(businessResult.timestamp).toBeDefined();
    expect(businessResult.statistics).toBeDefined();
    expect(businessResult.behavior).toBeDefined();
  });

  test('应该能够管理会话上下文', () => {
    const sessionId = 'user123';
    const sessionContext = businessLogicProcessor.getSessionContext(sessionId);
    
    expect(sessionContext).toBeDefined();
    expect(sessionContext.id).toBe(sessionId);
    expect(sessionContext.createdAt).toBeDefined();
    expect(sessionContext.lastActivity).toBeDefined();
    expect(sessionContext.messageCount).toBe(0);
    expect(sessionContext.history).toEqual([]);
  });

  test('应该能够设置自动回复状态', () => {
    expect(businessLogicProcessor.setAutoReplyEnabled(true)).toBe(true);
    expect(businessLogicProcessor.options.autoReplyEnabled).toBe(true);
    
    expect(businessLogicProcessor.setAutoReplyEnabled(false)).toBe(false);
    expect(businessLogicProcessor.options.autoReplyEnabled).toBe(false);
  });

  test('应该能够获取所有会话信息', () => {
    // 创建一些会话
    businessLogicProcessor.getSessionContext('user1');
    businessLogicProcessor.getSessionContext('user2');
    
    const sessions = businessLogicProcessor.getAllSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBeDefined();
    expect(sessions[0].createdAt).toBeDefined();
  });

  test('应该能够清理过期会话', () => {
    // 创建会话
    const session1 = businessLogicProcessor.getSessionContext('user1');
    const session2 = businessLogicProcessor.getSessionContext('user2');
    
    // 手动设置过期时间
    session1.lastActivity = Date.now() - 10000; // 10秒前
    session2.lastActivity = Date.now() - 10000; // 10秒前
    
    // 清理过期会话（maxAge = 5000ms = 5秒）
    const cleanupCount = businessLogicProcessor.cleanupSessions(5000);
    expect(cleanupCount).toBe(2);
    expect(businessLogicProcessor.getAllSessions()).toHaveLength(0);
  });

  test('应该能够处理错误情况', () => {
    const invalidResult = null;
    
    const result = businessLogicProcessor.process(invalidResult);
    expect(result.error).toBe('处理结果不能为空');
  });

  test('应该能够处理缺少客户端ID的情况', () => {
    const processedResult = {
      originalMessage: { content: 'test' },
      parsedMessage: { cleanContent: 'test' }
      // 缺少 clientId
    };
    
    const result = businessLogicProcessor.process(processedResult);
    expect(result.error).toBe('无法获取客户端ID');
  });

  test('应该能够处理包含clientId在originalMessage中的情况', () => {
    const processedResult = {
      originalMessage: { content: 'test', clientId: 'user456' },
      parsedMessage: { cleanContent: 'test' },
      bestIntent: { intent: 'greeting', confidence: 0.8 },
      timestamp: Date.now()
    };
    
    const result = businessLogicProcessor.process(processedResult);
    expect(result.sessionId).toBe('user456');
    expect(result.error).toBeUndefined();
  });
});