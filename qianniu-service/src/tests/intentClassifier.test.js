/**
 * IntentClassifier 单元测试
 * 测试意图分类器的各项功能
 */
const IntentClassifier = require('../services/messageProcessor/IntentClassifier');
const fs = require('fs');
const path = require('path');

// Mock natural库
jest.mock('natural', () => ({
  BayesClassifier: jest.fn().mockImplementation(() => ({
    addDocument: jest.fn(),
    train: jest.fn(),
    classify: jest.fn().mockReturnValue('greeting'),
    getClassifications: jest.fn().mockReturnValue([
      { label: 'greeting', value: 0.8 },
      { label: 'price_inquiry', value: 0.2 }
    ])
  })),
  TfIdf: jest.fn().mockImplementation(() => ({
    addDocument: jest.fn(),
    tfidfs: jest.fn().mockImplementation((term, callback) => {
      callback(0, 0.5); // 模拟TF-IDF分数
    })
  }))
}));

describe('IntentClassifier', () => {
  let intentClassifier;
  let mockIntentsData;
  
  beforeEach(() => {
    // 准备测试数据
    mockIntentsData = {
      intents: [
        {
          intent: 'greeting',
          patterns: ['你好', '您好', 'hello'],
          keywords: ['你好', '您好', '问候'],
          examples: [
            '你好',
            '您好，请问',
            'hello'
          ]
        },
        {
          intent: 'price_inquiry',
          patterns: ['多少钱', '价格', '费用'],
          keywords: ['价格', '钱', '费用', '多少'],
          examples: [
            '这个多少钱',
            '价格是多少',
            '费用怎么算'
          ]
        },
        {
          intent: 'farewell',
          patterns: ['再见', '拜拜', 'bye'],
          keywords: ['再见', '拜拜', '告别'],
          examples: [
            '再见',
            '拜拜',
            'bye bye'
          ]
        }
      ]
    };
    
    // Mock文件系统
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockIntentsData));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    intentClassifier = new IntentClassifier();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('构造函数和初始化', () => {
    test('应该正确初始化', () => {
      expect(intentClassifier).toBeInstanceOf(IntentClassifier);
      expect(intentClassifier.intents).toBeDefined();
      expect(intentClassifier.classifier).toBeDefined();
      expect(intentClassifier.tfidf).toBeDefined();
    });
    
    test('应该正确加载意图数据', () => {
      expect(intentClassifier.intents).toBeDefined();
      expect(Array.isArray(intentClassifier.intents)).toBe(true);
      expect(intentClassifier.intents.length).toBe(3);
    });
    
    test('应该初始化分类器', () => {
      expect(intentClassifier.classifier).toBeDefined();
      expect(intentClassifier.tfidf).toBeDefined();
    });
  });
  
  describe('loadIntents 方法', () => {
    test('当意图文件存在时应该正确加载', () => {
      intentClassifier.loadIntents();
      
      expect(intentClassifier.intents).toEqual(mockIntentsData.intents);
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    test('当意图文件不存在时应该设置空数组', () => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      
      intentClassifier.loadIntents();
      
      expect(Array.isArray(intentClassifier.intents)).toBe(true);
      expect(intentClassifier.intents.length).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });
    
    test('当文件读取失败时应该设置空数组', () => {
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('文件读取失败');
      });
      
      intentClassifier.loadIntents();
      
      expect(Array.isArray(intentClassifier.intents)).toBe(true);
      expect(intentClassifier.intents.length).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });
    
    test('当JSON解析失败时应该设置空数组', () => {
      jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');
      
      intentClassifier.loadIntents();
      
      expect(Array.isArray(intentClassifier.intents)).toBe(true);
      expect(intentClassifier.intents.length).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('分类器训练', () => {
    test('应该在初始化时训练贝叶斯分类器', () => {
      // 分类器应该在构造函数中自动训练
      expect(intentClassifier.classifier.addDocument).toHaveBeenCalled();
      expect(intentClassifier.classifier.train).toHaveBeenCalled();
    });
    
    test('应该在初始化时训练TF-IDF', () => {
      // TF-IDF应该在构造函数中自动初始化
      expect(intentClassifier.tfidf.addDocument).toHaveBeenCalled();
    });
    
    test('应该处理空意图数据', () => {
      const emptyClassifier = new IntentClassifier();
      emptyClassifier.intents = [];
      
      // 空意图数据时，分类器应该存在但未训练
      expect(emptyClassifier.classifier).toBeDefined();
      expect(emptyClassifier.intents).toEqual([]);
    });
  });
  
  describe('classify 方法', () => {
    test('应该正确分类消息', () => {
      const parsedMessage = {
        cleanContent: '你好，请问这个商品多少钱？',
        keywords: ['你好', '商品', '多少钱']
      };
      
      const result = intentClassifier.classify(parsedMessage);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('intent');
      expect(result[0]).toHaveProperty('confidence');
      expect(result[0]).toHaveProperty('method');
    });
    
    test('应该处理空消息', () => {
      const parsedMessage = {
        cleanContent: '',
        keywords: []
      };
      
      const result = intentClassifier.classify(parsedMessage);
      
      expect(Array.isArray(result)).toBe(true);
    });
    
    test('应该处理null或undefined消息', () => {
      expect(() => intentClassifier.classify(null)).not.toThrow();
      expect(() => intentClassifier.classify(undefined)).not.toThrow();
      
      const nullResult = intentClassifier.classify(null);
      const undefinedResult = intentClassifier.classify(undefined);
      
      expect(Array.isArray(nullResult)).toBe(true);
      expect(Array.isArray(undefinedResult)).toBe(true);
    });
    
    test('应该按置信度排序结果', () => {
      const parsedMessage = {
        cleanContent: '你好，多少钱',
        keywords: ['你好', '多少钱']
      };
      
      const result = intentClassifier.classify(parsedMessage);
      
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
        }
      }
    });
    
    test('应该限制返回结果数量', () => {
      const parsedMessage = {
        cleanContent: '你好，多少钱，再见',
        keywords: ['你好', '多少钱', '再见']
      };
      
      const result = intentClassifier.classify(parsedMessage);
      
      expect(result.length).toBeLessThanOrEqual(10); // 合理的最大结果数量
    });
  });
  
  describe('classifyByPatterns 方法', () => {
    test('应该通过模式匹配识别意图', () => {
      const content = '你好，请问';
      const result = intentClassifier.classifyByPatterns(content);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('intent');
        expect(result[0]).toHaveProperty('confidence');
        expect(result[0].method).toBe('pattern');
      }
    });
    
    test('应该处理没有匹配的情况', () => {
      const content = '完全不相关的内容xyz123';
      const result = intentClassifier.classifyByPatterns(content);
      
      expect(Array.isArray(result)).toBe(true);
    });
    
    test('应该处理空内容', () => {
      const result = intentClassifier.classifyByPatterns('');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
    
    test('应该处理正则表达式错误', () => {
      // 模拟包含无效正则的意图数据
      intentClassifier.intents = [{
        intent: 'test',
        patterns: ['[invalid regex'],
        keywords: [],
        examples: []
      }];
      
      expect(() => intentClassifier.classifyByPatterns('test')).not.toThrow();
    });
  });
  
  describe('classifyByKeywords 方法', () => {
    test('应该通过关键词匹配识别意图', () => {
      const keywords = ['你好', '价格'];
      const result = intentClassifier.classifyByKeywords(keywords);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('intent');
        expect(result[0]).toHaveProperty('confidence');
        expect(result[0].method).toBe('keyword');
      }
    });
    
    test('应该处理空关键词数组', () => {
      const result = intentClassifier.classifyByKeywords([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
    
    test('应该计算正确的匹配分数', () => {
      const keywords = ['你好', '您好'];
      const result = intentClassifier.classifyByKeywords(keywords);
      
      if (result.length > 0) {
        expect(result[0].confidence).toBeGreaterThan(0);
        expect(result[0].confidence).toBeLessThanOrEqual(1);
      }
    });
  });
  
  describe('classifyByClassifier 方法', () => {
    test('应该使用贝叶斯分类器识别意图', () => {
      const content = '你好世界';
      const result = intentClassifier.classifyByClassifier(content);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('intent');
        expect(result[0]).toHaveProperty('confidence');
        expect(result[0].method).toBe('classifier');
      }
    });
    
    test('应该处理空内容', () => {
      const result = intentClassifier.classifyByClassifier('');
      
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('classifyByTfIdf 方法', () => {
    test('应该使用TF-IDF识别意图', () => {
      const keywords = ['你好', '价格'];
      const result = intentClassifier.classifyByTfIdf(keywords);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('intent');
        expect(result[0]).toHaveProperty('confidence');
        expect(result[0].method).toBe('tfidf');
      }
    });
    
    test('应该处理空关键词', () => {
      const result = intentClassifier.classifyByTfIdf([]);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('deduplicateResults 方法', () => {
    test('应该去除重复的意图结果', () => {
      const results = [
        { intent: 'greeting', confidence: 0.8, method: 'pattern' },
        { intent: 'greeting', confidence: 0.7, method: 'keyword' },
        { intent: 'price_inquiry', confidence: 0.6, method: 'classifier' }
      ];
      
      const deduplicated = intentClassifier.deduplicateResults(results);
      
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].intent).toBe('greeting');
      expect(deduplicated[0].confidence).toBe(0.8); // 应该保留最高置信度
      expect(deduplicated[1].intent).toBe('price_inquiry');
    });
    
    test('应该处理空结果数组', () => {
      const result = intentClassifier.deduplicateResults([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('getConfidenceThreshold 方法', () => {
    test('应该返回正确的置信度阈值', () => {
      const threshold = intentClassifier.getConfidenceThreshold('greeting');
      
      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });
    
    test('应该为未知意图返回默认阈值', () => {
      const threshold = intentClassifier.getConfidenceThreshold('unknown_intent');
      
      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });
  });
  
  describe('getBestIntent 方法', () => {
    test('应该返回最佳意图', () => {
      const parsedMessage = {
        cleanContent: '你好，请问这个商品多少钱？',
        keywords: ['你好', '商品', '多少钱']
      };
      
      const best = intentClassifier.getBestIntent(parsedMessage);
      
      expect(best).toBeDefined();
      expect(best).toHaveProperty('intent');
      expect(best).toHaveProperty('confidence');
    });
    
    test('应该处理空消息', () => {
      const parsedMessage = {
        cleanContent: '',
        keywords: []
      };
      
      const best = intentClassifier.getBestIntent(parsedMessage);
      
      expect(best).toBeNull();
    });
    
    test('应该处理null消息', () => {
      const best = intentClassifier.getBestIntent(null);
      
      expect(best).toBeNull();
    });
  });
  
  describe('边界条件和错误处理', () => {
    test('应该处理非常长的文本', () => {
      const longContent = '你好'.repeat(1000);
      const parsedMessage = {
        cleanContent: longContent,
        keywords: ['你好']
      };
      
      expect(() => intentClassifier.classify(parsedMessage)).not.toThrow();
    });
    
    test('应该处理特殊字符', () => {
      const parsedMessage = {
        cleanContent: '你好@#$%^&*()',
        keywords: ['你好']
      };
      
      expect(() => intentClassifier.classify(parsedMessage)).not.toThrow();
    });
    
    test('应该处理Unicode字符', () => {
      const parsedMessage = {
        cleanContent: '你好🙂世界👍',
        keywords: ['你好', '世界']
      };
      
      expect(() => intentClassifier.classify(parsedMessage)).not.toThrow();
    });
  });
  
  describe('性能测试', () => {
    test('应该在合理时间内处理大量分类请求', () => {
      const messages = Array.from({length: 100}, (_, i) => ({
        cleanContent: `测试消息${i}你好价格多少钱`,
        keywords: ['测试', '你好', '价格', '多少钱']
      }));
      
      const startTime = Date.now();
      
      messages.forEach(message => {
        intentClassifier.classify(message);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100次分类应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });
  });
});