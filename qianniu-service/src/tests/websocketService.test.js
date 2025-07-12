/**
 * WebSocket服务测试
 */
const WebSocket = require('ws');
const WebSocketService = require('../services/websocketService');

// 测试配置
const TEST_PORT = 3001;
const TEST_PATH = '/ws';

// Mock ErrorHandler
jest.mock('../utils/ErrorHandler', () => {
  return jest.fn().mockImplementation(() => {
    return {
      handle: jest.fn((error) => error),
      context: 'MockErrorHandler'
    };
  });
});

// Mock Logger
jest.mock('../utils/Logger', () => {
  return jest.fn().mockImplementation(() => {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });
});

// Mock PerformanceMonitor
jest.mock('../utils/PerformanceMonitor', () => {
  return jest.fn().mockImplementation(() => {
    return {
      recordMetric: jest.fn(),
      recordCounter: jest.fn(),
      recordGauge: jest.fn(),
      getMetrics: jest.fn(() => ({})),
      reset: jest.fn(),
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn().mockResolvedValue()
    };
  });
});

// Mock SessionManager
jest.mock('../utils/SessionManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      cleanup: jest.fn(),
      startCleanup: jest.fn(),
      stopCleanup: jest.fn().mockResolvedValue()
    };
  });
});

describe('WebSocketService', () => {
  let service;
  let client;
  
  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    // 使用fake timers来控制定时器
    jest.useFakeTimers();
  });
  
  afterEach(async () => {
    // 清理资源
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    if (service && service.server) {
      await service.stop();
    }
    // 清理所有定时器
    jest.clearAllTimers();
    // 恢复真实定时器
    jest.useRealTimers();
  });
    
  test('应该能够创建WebSocketService实例', () => {
    service = new WebSocketService({
      port: TEST_PORT,
      path: TEST_PATH
    });
    
    expect(service).toBeDefined();
    expect(service.options.port).toBe(TEST_PORT);
    expect(service.options.path).toBe(TEST_PATH);
  });
  
  test('应该能够启动和停止服务', () => {
    service = new WebSocketService({
      port: TEST_PORT,
      path: TEST_PATH
    });
    
    // 启动服务
    service.start();
    expect(service.server).toBeDefined();
    
    // 停止服务
    service.stop();
  });
  
  test('应该能够处理客户端连接', () => {
    service = new WebSocketService({
      port: TEST_PORT,
      path: TEST_PATH
    });
    
    const mockClient = {
      id: 'test-client',
      ws: {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN
      },
      lastHeartbeat: Date.now()
    };
    
    // 模拟客户端连接
    service.clients.set('test-client', mockClient);
    
    expect(service.clients.has('test-client')).toBe(true);
    expect(service.clients.get('test-client')).toBe(mockClient);
  });
  
  test('应该能够发送消息给特定客户端', () => {
    service = new WebSocketService({
      port: TEST_PORT,
      path: TEST_PATH
    });
    
    const mockClient = {
      id: 'test-client',
      ws: {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN
      },
      lastHeartbeat: Date.now()
    };
    
    service.clients.set('test-client', mockClient);
    
    const message = { type: 'test', content: '测试消息' };
    service.sendTo('test-client', message);
    
    expect(mockClient.ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  
  test('应该能够广播消息给所有客户端', () => {
    service = new WebSocketService({
      port: TEST_PORT,
      path: TEST_PATH
    });
    
    const mockClient1 = {
      id: 'client1',
      ws: {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN
      },
      lastHeartbeat: Date.now()
    };
    const mockClient2 = {
      id: 'client2',
      ws: {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN
      },
      lastHeartbeat: Date.now()
    };
    
    service.clients.set('client1', mockClient1);
    service.clients.set('client2', mockClient2);
    
    const message = { type: 'broadcast', content: '广播消息' };
    service.broadcast(message);
    
    expect(mockClient1.ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockClient2.ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
});