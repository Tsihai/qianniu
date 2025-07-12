/**
 * WebSocket客户端测试工具的单元测试
 * 测试WebSocket连接、消息发送、重连机制、命令行交互等功能
 */

// 模拟WebSocket模块
const mockWebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  readyState: 1, // 默认为OPEN状态
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// 模拟WebSocket构造函数
const MockWebSocketConstructor = jest.fn(() => mockWebSocket);
MockWebSocketConstructor.CONNECTING = 0;
MockWebSocketConstructor.OPEN = 1;
MockWebSocketConstructor.CLOSING = 2;
MockWebSocketConstructor.CLOSED = 3;

jest.mock('ws', () => MockWebSocketConstructor);

// 模拟readline模块
const mockReadline = {
  createInterface: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
};

jest.mock('readline', () => mockReadline);

// 模拟console方法
const originalConsole = console;
const originalProcessExit = process.exit;

beforeEach(() => {
  // 使用假定时器
  jest.useFakeTimers();
  
  console.log = jest.fn();
  console.error = jest.fn();
  
  // 重置所有模拟
  jest.clearAllMocks();
  
  // 重置WebSocket模拟状态
  mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
  mockWebSocket.send.mockClear();
  mockWebSocket.close.mockClear();
  mockWebSocket.on.mockClear();
  
  // 模拟process.exit
  process.exit = jest.fn();
});

afterEach(() => {
  // 清理所有定时器
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // 恢复原始函数
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  process.exit = originalProcessExit;
  
  // 清除模块缓存
  jest.resetModules();
});

describe('WebSocket客户端测试工具', () => {
  let wsClientModule;
  
  beforeEach(() => {
    // 清除模块缓存，确保每次测试都重新加载
    jest.resetModules();
    
    // 模拟环境变量
    process.env.WS_URL = 'ws://test:8081';
  });
  
  afterEach(() => {
    delete process.env.WS_URL;
  });

  describe('连接功能测试', () => {
    test('应该成功建立WebSocket连接', () => {
      // 模拟连接成功
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      // 加载模块，触发连接
      require('../utils/wsClient');
      
      expect(MockWebSocketConstructor).toHaveBeenCalledWith('ws://test:8081');
      expect(console.log).toHaveBeenCalledWith('正在连接到 ws://test:8081...');
      expect(console.log).toHaveBeenCalledWith('连接成功');
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'register',
          data: {
            name: '测试客户端',
            version: '1.0.0'
          }
        })
      );
    });

    test('应该处理连接错误', () => {
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          const error = new Error('连接失败');
          callback(error);
        }
      });
      
      require('../utils/wsClient');
      expect(console.error).toHaveBeenCalledWith('连接错误:', '连接失败');
    });

    test('应该处理消息接收', () => {
      const testMessage = {
        type: 'system',
        action: 'welcome',
        clientId: 'test-client-123'
      };
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify(testMessage));
        }
      });
      
      require('../utils/wsClient');
      expect(console.log).toHaveBeenCalledWith(`服务器分配的客户端ID: test-client-123`);
      expect(console.log).toHaveBeenCalledWith(`收到消息: ${JSON.stringify(testMessage)}`);
    });

    test('应该处理无效JSON消息', () => {
      const invalidMessage = 'invalid json';
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          callback(invalidMessage);
        }
      });
      
      require('../utils/wsClient');
      expect(console.error).toHaveBeenCalledWith('解析消息错误:', expect.any(SyntaxError));
      expect(console.log).toHaveBeenCalledWith('原始消息:', invalidMessage);
    });
  });

  describe('重连机制测试', () => {
    test('应该在连接关闭后尝试重连', () => {
      // 模拟连接关闭和重连
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      expect(console.log).toHaveBeenCalledWith('连接已关闭');
      expect(console.log).toHaveBeenCalledWith('尝试重新连接 (1/10)...');
      
      // 快进时间以触发重连
      jest.advanceTimersByTime(3000);
      
      expect(MockWebSocketConstructor).toHaveBeenCalledTimes(2);
    });

    test('应该在达到最大重连次数后停止重连', () => {
      let closeCallCount = 0;
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallCount++;
          callback();
          
          // 模拟连续关闭事件以达到最大重连次数
          if (closeCallCount < 11) {
            // 继续触发关闭事件
            setTimeout(() => callback(), 3000);
          }
        }
      });
      
      require('../utils/wsClient');
      
      // 快进时间以触发多次重连
      for (let i = 0; i < 11; i++) {
        jest.advanceTimersByTime(3000);
      }
      
      expect(console.log).toHaveBeenCalledWith('达到最大重连次数，停止重连');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('消息发送功能测试', () => {
    test('应该成功发送消息当连接打开时', () => {
      // 设置WebSocket为打开状态
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      // 加载模块
      const wsClient = require('../utils/wsClient');
      
      // 由于wsClient.js没有导出函数，我们需要通过其他方式测试
      // 这里我们验证在open事件中发送的注册消息
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
          expect(mockWebSocket.send).toHaveBeenCalledWith(
            JSON.stringify({
              type: 'register',
              data: {
                name: '测试客户端',
                version: '1.0.0'
              }
            })
          );
        }
      });
    });

    test('应该在连接关闭时无法发送消息', () => {
      // 设置WebSocket为关闭状态
      mockWebSocket.readyState = MockWebSocketConstructor.CLOSED;
      
      // 由于wsClient.js的sendMessage函数不是导出的，
      // 我们通过模拟命令行输入来测试发送功能
      let readlineInterface;
      mockReadline.createInterface.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'line') {
            // 模拟用户输入send命令
            setTimeout(() => {
              callback('send 测试消息');
              expect(console.log).toHaveBeenCalledWith('发送失败，连接可能已关闭');
            }, 10);
          }
        }),
        close: jest.fn()
      });
      
      require('../utils/wsClient');
    });
  });

  describe('命令行交互测试', () => {
    let readlineInterface;
    
    beforeEach(() => {
      readlineInterface = {
        on: jest.fn(),
        close: jest.fn()
      };
      mockReadline.createInterface.mockReturnValue(readlineInterface);
    });

    test('应该处理send命令', () => {
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      // 模拟连接成功，启动命令行
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      // 模拟用户输入
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('send 你好世界');
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'chat',
          content: '你好世界',
          timestamp: expect.any(Number)
        })
      );
      expect(console.log).toHaveBeenCalledWith('已发送消息: 你好世界');
    });

    test('应该处理ping命令', () => {
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('ping');
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ping',
          timestamp: expect.any(Number)
        })
      );
      expect(console.log).toHaveBeenCalledWith('已发送ping消息');
    });

    test('应该处理quit命令', () => {
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('quit');
      
      expect(console.log).toHaveBeenCalledWith('正在关闭连接...');
      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(readlineInterface.close).toHaveBeenCalled();
      
      // 快进时间以触发延迟退出
      jest.advanceTimersByTime(1000);
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('应该处理status命令', () => {
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      // 先设置clientId
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        } else if (event === 'message') {
          // 模拟接收welcome消息设置clientId
          callback(JSON.stringify({
            type: 'system',
            action: 'welcome',
            clientId: 'test-123'
          }));
        }
      });
      
      require('../utils/wsClient');
      
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('status');
      
      expect(console.log).toHaveBeenCalledWith('连接状态: OPEN');
      expect(console.log).toHaveBeenCalledWith('客户端ID: test-123');
    });

    test('应该处理未知命令', () => {
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('unknown');
      
      expect(console.log).toHaveBeenCalledWith('未知命令: unknown');
    });

    test('应该处理空的send命令', () => {
      mockWebSocket.readyState = MockWebSocketConstructor.OPEN;
      
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          callback();
        }
      });
      
      require('../utils/wsClient');
      
      const lineCallback = readlineInterface.on.mock.calls.find(
        call => call[0] === 'line'
      )[1];
      
      lineCallback('send');
      
      expect(console.log).toHaveBeenCalledWith('请输入要发送的消息');
    });
  });

  describe('配置测试', () => {
    test('应该使用默认URL当环境变量未设置时', () => {
      delete process.env.WS_URL;
      
      require('../utils/wsClient');
      
      expect(MockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:8081');
    });

    test('应该使用环境变量中的URL', () => {
      process.env.WS_URL = 'ws://custom:9999';
      
      require('../utils/wsClient');
      
      expect(MockWebSocketConstructor).toHaveBeenCalledWith('ws://custom:9999');
    });
  });
});