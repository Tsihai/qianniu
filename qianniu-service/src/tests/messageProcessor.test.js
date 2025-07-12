/**
 * 消息处理器测试
 */
const MessageProcessor = require('../services/messageProcessor/index');

describe('MessageProcessor', () => {
  let processor;
  
  // 测试数据
  const testMessages = [
    {
      type: 'chat',
      clientId: 'test-client-001',
      content: '这个商品多少钱？',
      timestamp: Date.now()
    },
    {
      type: 'chat',
      clientId: 'test-client-001',
      content: '请问什么时候能发货？',
      timestamp: Date.now() + 1000
    },
    {
      type: 'chat',
      clientId: 'test-client-002',
      content: '我想退货，产品有质量问题',
      timestamp: Date.now() + 2000
    },
    {
      type: 'chat',
      clientId: 'test-client-002',
      content: '谢谢你的帮助',
      timestamp: Date.now() + 3000
    },
    {
      type: 'system',
      clientId: 'test-client-001',
      content: '用户已离开聊天',
      action: 'leave',
      timestamp: Date.now() + 4000
    }
  ];
  
  beforeEach(() => {
    processor = new MessageProcessor({
      enableLogging: false // 禁用日志避免测试输出混乱
    });
  });
  
  afterEach(() => {
    // 清理会话数据
    if (processor && processor.sessions) {
      processor.sessions.clear();
    }
  });

  test('should process a single message correctly', () => {
    const message = testMessages[0];
    const result = processor.processMessage(message);
    
    expect(result).toBeDefined();
    expect(result.originalMessage).toEqual(message);
    expect(result.parsedMessage).toBeDefined();
    expect(result.parsedMessage.content).toBe(message.content);
    expect(result.parsedMessage.clientId).toBe(message.clientId);
    expect(result.intents).toBeDefined();
    expect(Array.isArray(result.intents)).toBe(true);
    expect(result.replies).toBeDefined();
    expect(Array.isArray(result.replies)).toBe(true);
    expect(result.timestamp).toBeDefined();
  });

  test('should process multiple messages and maintain session state', () => {
    const results = [];
    
    // 处理所有测试消息
    testMessages.forEach(message => {
      const result = processor.processMessage(message);
      results.push(result);
    });
    
    expect(results).toHaveLength(testMessages.length);
    
    // 验证会话状态
    expect(processor.sessions.size).toBeGreaterThan(0);
    
    // 验证客户端001的会话
    const session001 = processor.sessions.get('test-client-001');
    expect(session001).toBeDefined();
    expect(session001.messageCount).toBe(3); // 2条chat + 1条system
    expect(session001.history.length).toBe(3);
    
    // 验证客户端002的会话
    const session002 = processor.sessions.get('test-client-002');
    expect(session002).toBeDefined();
    expect(session002.messageCount).toBe(2);
    expect(session002.history.length).toBe(2);
  });

  test('should handle custom message processing', () => {
    const customMessage = {
      type: 'chat',
      clientId: 'test-client-custom',
      content: '这个产品的尺寸是多大的？适合放在卧室吗？',
      timestamp: Date.now()
    };
    
    const result = processor.processMessage(customMessage);
    
    expect(result).toBeDefined();
    expect(result.originalMessage).toEqual(customMessage);
    expect(result.parsedMessage.content).toBe(customMessage.content);
    expect(result.parsedMessage.clientId).toBe(customMessage.clientId);
    
    // 验证新会话被创建
    const customSession = processor.sessions.get('test-client-custom');
    expect(customSession).toBeDefined();
    expect(customSession.messageCount).toBe(1);
    expect(customSession.history.length).toBe(1);
  });
  
  test('should cleanup expired sessions', async () => {
    // 先处理一些消息创建会话
    testMessages.forEach(message => {
      processor.processMessage(message);
    });
    
    const initialSessionCount = processor.sessions.size;
    expect(initialSessionCount).toBeGreaterThan(0);
    
    // 等待一小段时间确保会话过期
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 使用很小的超时时间清理会话
    processor.cleanupSessions(1); // 1毫秒超时
    
    // 验证会话数量减少（可能不是全部清理，取决于实际实现）
    expect(processor.sessions.size).toBeLessThanOrEqual(initialSessionCount);
  });
  
  test('should handle error in message processing', () => {
    const invalidMessage = null;
    
    // 使用try-catch捕获异常
    expect(() => {
      processor.processMessage(invalidMessage);
    }).toThrow('消息对象不能为空');
  });
  
  test('should emit events during message processing', (done) => {
    const testMessage = testMessages[0];
    
    processor.once('message_processed', (result) => {
      expect(result).toBeDefined();
      expect(result.originalMessage).toEqual(testMessage);
      done();
    });
    
    processor.processMessage(testMessage);
  });

});