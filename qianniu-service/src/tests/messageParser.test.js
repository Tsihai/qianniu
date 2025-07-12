/**
 * MessageParser 单元测试
 * 测试消息解析器的各项功能
 */
const MessageParser = require('../services/messageProcessor/MessageParser');
const fs = require('fs');
const path = require('path');

describe('MessageParser', () => {
  let messageParser;
  
  beforeEach(() => {
    messageParser = new MessageParser();
  });
  
  afterEach(() => {
    // 清理可能创建的测试文件
    jest.clearAllMocks();
  });
  
  describe('构造函数和初始化', () => {
    test('应该正确初始化', () => {
      expect(messageParser).toBeInstanceOf(MessageParser);
      expect(messageParser.stopwords).toBeDefined();
      expect(Array.isArray(messageParser.stopwords)).toBe(true);
      expect(messageParser.stopwords.length).toBeGreaterThan(0);
    });
  });
  
  describe('loadStopWords 方法', () => {
    test('当停用词文件存在时应该正确加载', () => {
      const mockStopWords = ['的', '了', '在', '是'];
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockStopWords));
      
      const result = messageParser.loadStopWords();
      
      expect(result).toEqual(mockStopWords);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    test('当停用词文件不存在时应该返回默认停用词', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      const result = messageParser.loadStopWords();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('的');
      expect(result).toContain('了');
    });
    
    test('当文件读取失败时应该返回默认停用词', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('文件读取失败');
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = messageParser.loadStopWords();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('parse 方法', () => {
    test('应该正确解析普通聊天消息', () => {
      const message = {
        type: 'chat',
        content: '你好，请问这个商品多少钱？',
        sender: 'user123',
        timestamp: Date.now()
      };
      
      const result = messageParser.parse(message);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('chat');
      expect(result.originalContent).toBe(message.content);
      expect(result.cleanContent).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(Array.isArray(result.tokens)).toBe(true);
      expect(Array.isArray(result.keywords)).toBe(true);
    });
    
    test('应该正确解析系统消息', () => {
      const message = {
        type: 'system',
        content: '用户已进入聊天室',
        timestamp: Date.now()
      };
      
      const result = messageParser.parse(message);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('system');
      expect(result.originalContent).toBe(message.content);
      expect(result.cleanContent).toBeDefined();
    });
    
    test('应该处理空消息', () => {
      const message = {
        type: 'chat',
        content: '',
        sender: 'user123'
      };
      
      const result = messageParser.parse(message);
      
      expect(result).toBeDefined();
      expect(result.cleanContent).toBe('');
      expect(result.tokens).toEqual([]);
      expect(result.keywords).toEqual([]);
    });
    
    test('应该处理null或undefined消息', () => {
      expect(() => messageParser.parse(null)).toThrow('消息对象不能为空');
      expect(() => messageParser.parse(undefined)).toThrow('消息对象不能为空');
    });
    
    test('应该处理没有content字段的消息', () => {
      const message = {
        type: 'chat',
        sender: 'user123'
      };
      
      const result = messageParser.parse(message);
      
      expect(result).toBeDefined();
      expect(result.cleanContent).toBe('');
    });
  });
  
  describe('cleanText 方法', () => {
    test('应该移除HTML标签', () => {
      const text = '<p>你好</p><br/>世界';
      const result = messageParser.cleanText(text);
      
      expect(result).toBe('你好世界');
    });
    
    test('应该移除多余的空白字符', () => {
      const text = '  你好   世界  \n\t  ';
      const result = messageParser.cleanText(text);
      
      expect(result).toBe('你好 世界');
    });
    
    test('应该移除特殊字符', () => {
      const text = '你好@#$%^&*()世界！？。，';
      const result = messageParser.cleanText(text);
      
      expect(result).toBe('你好 世界');
    });
    
    test('应该处理空字符串', () => {
      const result = messageParser.cleanText('');
      expect(result).toBe('');
    });
    
    test('应该处理null和undefined', () => {
      expect(messageParser.cleanText(null)).toBe('');
      expect(messageParser.cleanText(undefined)).toBe('');
    });
    
    test('应该保留中文字符和数字', () => {
      const text = '商品价格是99元';
      const result = messageParser.cleanText(text);
      
      expect(result).toBe('商品价格是99元');
    });
  });
  
  describe('tokenize 方法', () => {
    test('应该正确分词中文文本', () => {
      const text = '你好世界';
      const result = messageParser.tokenize(text);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(token => typeof token === 'string')).toBe(true);
    });
    
    test('应该处理包含数字的文本', () => {
      const text = '价格99元';
      const result = messageParser.tokenize(text);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
    
    test('应该处理空字符串', () => {
      const result = messageParser.tokenize('');
      expect(result).toEqual([]);
    });
    
    test('应该正确分词', () => {
      const text = '我是好人';
      const result = messageParser.tokenize(text);
      
      expect(Array.isArray(result)).toBe(true);
      result.forEach(token => {
        expect(typeof token).toBe('string');
      });
    });
  });
  
  describe('extractKeywords 方法', () => {
    test('应该从文本中提取关键词', () => {
      const text = '商品价格多少钱有优惠吗';
      const result = messageParser.extractKeywords(text, 5);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.every(keyword => typeof keyword === 'string')).toBe(true);
    });
    
    test('应该过滤停用词', () => {
      const text = '商品的价格是多少';
      const result = messageParser.extractKeywords(text, 5);
      
      // 停用词应该被过滤掉
      expect(result.includes('的')).toBe(false);
      expect(result.includes('是')).toBe(false);
    });
    
    test('应该限制关键词数量', () => {
      const text = '商品的价格是多少关键词测试内容';
      const result = messageParser.extractKeywords(text, 3);
      
      expect(result.length).toBeLessThanOrEqual(3);
    });
    
    test('应该处理大量关键词', () => {
      const text = Array.from({length: 20}, (_, i) => `关键词${i}`).join(' ');
      const result = messageParser.extractKeywords(text, 10);
      
      expect(result.length).toBeLessThanOrEqual(10);
    });
    
    test('应该处理空字符串', () => {
      const result = messageParser.extractKeywords('', 5);
      expect(result).toEqual([]);
    });
    
    test('应该去重关键词', () => {
      const text = '商品商品价格价格';
      const result = messageParser.extractKeywords(text, 5);
      
      const uniqueResult = [...new Set(result)];
      expect(result.length).toBe(uniqueResult.length);
    });
  });
  
  describe('边界条件和错误处理', () => {
    test('应该处理非常长的文本', () => {
      const longText = '商品'.repeat(1000);
      const message = {
        type: 'chat',
        content: longText,
        sender: 'user123'
      };
      
      expect(() => messageParser.parse(message)).not.toThrow();
      const result = messageParser.parse(message);
      expect(result).toBeDefined();
    });
    
    test('应该处理特殊Unicode字符', () => {
      const text = '你好🙂世界👍';
      const result = messageParser.cleanText(text);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    test('应该处理混合语言文本', () => {
      const text = 'Hello你好World世界123';
      const message = {
        type: 'chat',
        content: text,
        sender: 'user123'
      };
      
      const result = messageParser.parse(message);
      expect(result).toBeDefined();
      expect(result.cleanContent).toBeDefined();
    });
  });
  
  describe('性能测试', () => {
    test('应该在合理时间内处理大量消息', () => {
      const messages = Array.from({length: 100}, (_, i) => ({
        type: 'chat',
        content: `测试消息${i}，包含一些关键词和内容`,
        sender: `user${i}`
      }));
      
      const startTime = Date.now();
      
      messages.forEach(message => {
        messageParser.parse(message);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100条消息应该在1秒内处理完成
      expect(duration).toBeLessThan(1000);
    });
  });
});