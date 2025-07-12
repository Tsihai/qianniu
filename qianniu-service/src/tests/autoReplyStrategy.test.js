/**
 * AutoReplyStrategy 单元测试
 * 测试自动回复策略的各项功能
 */
const AutoReplyStrategy = require('../services/businessLogic/strategies/AutoReplyStrategy');
const fs = require('fs');
const path = require('path');

describe('AutoReplyStrategy', () => {
  let autoReplyStrategy;
  let mockRulesData;
  let mockDataService;
  
  beforeEach(async () => {
    // 准备测试数据
    mockRulesData = [
      {
        intent: 'greeting',
        rules: [
          { pattern: '.*你好.*', reply: '您好！很高兴为您服务。有什么可以帮到您？' },
          { pattern: '.*您好.*', reply: '您好！欢迎咨询。' }
        ],
        defaultReply: '您好！'
      },
      {
        intent: 'price_inquiry',
        rules: [
          { pattern: '.*多少钱.*', reply: '您好，该商品的具体价格请查看商品详情页面。' },
          { pattern: '.*优惠.*', reply: '目前我们有多种促销活动，具体可以参考商品详情页。' }
        ]
      },
      {
        intent: 'farewell',
        rules: [
          { pattern: '.*再见.*', reply: '感谢您的咨询，祝您购物愉快！' }
        ]
      }
    ];
    
    // 模拟数据服务
    mockDataService = {
      getAllIntentTemplates: jest.fn().mockResolvedValue([
        {
          name: 'greeting',
          category: 'auto_reply',
          patterns: ['.*你好.*', '.*您好.*'],
          responses: ['您好！很高兴为您服务。有什么可以帮到您？'],
          defaultReply: '您好！'
        },
        {
          name: 'price_inquiry',
          category: 'auto_reply',
          patterns: ['.*多少钱.*', '.*优惠.*'],
          responses: ['您好，该商品的具体价格请查看商品详情页面。']
        }
      ]),
      getIntentTemplate: jest.fn().mockResolvedValue(null),
      createIntentTemplate: jest.fn().mockResolvedValue({ id: 'template1', name: 'test' }),
      updateIntentTemplate: jest.fn().mockResolvedValue({ id: 'template1', name: 'test' })
    };
    
    // Mock文件系统
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockRulesData));
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    autoReplyStrategy = new AutoReplyStrategy({ dataService: mockDataService });
    // 等待异步初始化完成
    await autoReplyStrategy.loadRules();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('构造函数和初始化', () => {
    test('应该正确初始化默认配置', () => {
      expect(autoReplyStrategy.options).toBeDefined();
      expect(autoReplyStrategy.options.confidenceThreshold).toBe(0.6);
      expect(autoReplyStrategy.options.maxRepliesPerIntent).toBe(3);
      expect(autoReplyStrategy.options.enableCustomRules).toBe(true);
      expect(autoReplyStrategy.replyMode).toBe('suggest');
    });
    
    test('应该接受自定义配置', () => {
      const customOptions = {
        confidenceThreshold: 0.8,
        maxRepliesPerIntent: 5,
        enableCustomRules: false,
        replyMode: 'auto',
        dataService: mockDataService
      };
      
      const customStrategy = new AutoReplyStrategy(customOptions);
      
      expect(customStrategy.options.confidenceThreshold).toBe(0.8);
      expect(customStrategy.options.maxRepliesPerIntent).toBe(5);
      expect(customStrategy.options.enableCustomRules).toBe(false);
      expect(customStrategy.replyMode).toBe('auto');
    });
    
    test('应该正确加载规则', () => {
      expect(autoReplyStrategy.rules).toBeDefined();
      expect(Array.isArray(autoReplyStrategy.rules)).toBe(true);
      expect(autoReplyStrategy.rules.length).toBe(2); // mockDataService返回2个模板
    });
  });
  
  describe('loadRules 方法', () => {
    test('当规则文件存在时应该正确加载', async () => {
      const result = await autoReplyStrategy.loadRules();
      
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          intent: expect.any(String),
          rules: expect.any(Array)
        })
      ]));
      expect(autoReplyStrategy.rules).toEqual(result);
    });
    
    test('当dataService返回空数组时应该返回空数组', async () => {
      mockDataService.getAllIntentTemplates.mockResolvedValue([]);
      
      const result = await autoReplyStrategy.loadRules();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      expect(autoReplyStrategy.rules).toEqual(result);
    });
    
    test('当dataService获取失败时应该返回默认规则', async () => {
      mockDataService.getAllIntentTemplates.mockRejectedValue(new Error('数据获取失败'));
      
      const result = await autoReplyStrategy.loadRules();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(autoReplyStrategy.rules).toEqual(result);
    });
    
    test('当dataService返回无效数据时应该返回默认规则', async () => {
      mockDataService.getAllIntentTemplates.mockResolvedValue(null);
      
      const result = await autoReplyStrategy.loadRules();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(autoReplyStrategy.rules).toEqual(result);
    });
  });
  
  describe('saveRules 方法', () => {
    test('应该成功保存规则', async () => {
      const newRules = [{
        intent: 'test',
        rules: [{ pattern: 'test', reply: 'test reply' }]
      }];
      
      const result = await autoReplyStrategy.saveRules(newRules);
      
      expect(result).toBe(true);
      expect(mockDataService.createIntentTemplate).toHaveBeenCalled();
      expect(autoReplyStrategy.rules).toEqual(newRules);
    });
    
    test('应该通过dataService保存规则', async () => {
      const newRules = [{ 
        intent: 'test', 
        rules: [{ pattern: '.*test.*', reply: 'test reply' }] 
      }];
      
      const result = await autoReplyStrategy.saveRules(newRules);
      
      expect(result).toBe(true);
      expect(mockDataService.createIntentTemplate).toHaveBeenCalled();
      expect(autoReplyStrategy.rules).toEqual(newRules);
    });
    
    test('当保存失败时应该返回false', async () => {
      // Mock dataService方法抛出错误
      mockDataService.createIntentTemplate.mockRejectedValue(new Error('保存失败'));
      
      const result = await autoReplyStrategy.saveRules([{
        intent: 'test',
        rules: [{ pattern: '.*test.*', reply: 'test reply' }]
      }]);
      
      expect(result).toBe(false);
    });
  });
  
  describe('process 方法', () => {
    test('应该正确处理有效的消息处理结果', () => {
      const processedResult = {
        parsedMessage: {
          cleanContent: '你好，请问这个商品多少钱？'
        },
        intents: [
          { intent: 'greeting', confidence: 0.8 },
          { intent: 'price_inquiry', confidence: 0.7 }
        ]
      };
      
      const sessionContext = {
        customerInfo: { name: '张三' },
        messageCount: 5
      };
      
      const result = autoReplyStrategy.process(processedResult, sessionContext);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.mode).toBe('suggest');
      expect(result.shouldAutoSend).toBe(false);
    });
    
    test('应该处理无效的消息处理结果', () => {
      const result1 = autoReplyStrategy.process(null, {});
      const result2 = autoReplyStrategy.process({}, {});
      const result3 = autoReplyStrategy.process({ parsedMessage: null }, {});
      
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });
    
    test('应该处理低置信度意图', () => {
      const processedResult = {
        parsedMessage: {
          cleanContent: '测试消息'
        },
        intents: [
          { intent: 'greeting', confidence: 0.3 }
        ]
      };
      
      const result = autoReplyStrategy.process(processedResult, {});
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('default');
      expect(result.confidence).toBe(0.3);
    });
    
    test('应该处理没有意图的情况', () => {
      const processedResult = {
        parsedMessage: {
          cleanContent: '测试消息'
        },
        intents: []
      };
      
      const result = autoReplyStrategy.process(processedResult, {});
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('default');
    });
    
    test('应该限制回复数量', () => {
      autoReplyStrategy.options.maxRepliesPerIntent = 2;
      
      const processedResult = {
        parsedMessage: {
          cleanContent: '你好，多少钱，再见'
        },
        intents: [
          { intent: 'greeting', confidence: 0.8 },
          { intent: 'price_inquiry', confidence: 0.7 },
          { intent: 'farewell', confidence: 0.6 }
        ]
      };
      
      const result = autoReplyStrategy.process(processedResult, {});
      
      expect(result.success).toBe(true);
      expect(result.alternatives.length).toBeLessThanOrEqual(1); // maxRepliesPerIntent - 1
    });
    
    test('应该根据回复模式设置shouldAutoSend', () => {
      autoReplyStrategy.replyMode = 'auto';
      
      const processedResult = {
        parsedMessage: {
          cleanContent: '你好'
        },
        intents: [
          { intent: 'greeting', confidence: 0.8 }
        ]
      };
      
      const result = autoReplyStrategy.process(processedResult, {});
      
      expect(result.shouldAutoSend).toBe(true);
    });
  });
  
  describe('generateReplyByIntent 方法', () => {
    test('应该根据意图和模式生成回复', () => {
      const content = '你好，请问';
      const context = { customerInfo: { name: '张三' } };
      
      const reply = autoReplyStrategy.generateReplyByIntent('greeting', content, context);
      
      expect(reply).toBeDefined();
      expect(typeof reply).toBe('string');
      expect(reply.length).toBeGreaterThan(0);
    });
    
    test('应该处理不存在的意图', () => {
      const reply = autoReplyStrategy.generateReplyByIntent('nonexistent', 'test', {});
      
      expect(reply).toBeNull();
    });
    
    test('应该处理没有匹配模式的情况', () => {
      const content = '完全不匹配的内容xyz123';
      
      const reply = autoReplyStrategy.generateReplyByIntent('greeting', content, {});
      
      // 应该返回默认回复或null
      expect(reply === null || typeof reply === 'string').toBe(true);
    });
    
    test('应该使用默认回复当没有模式匹配时', () => {
      const content = 'xyz123完全不匹配的内容abc';
      
      // 调试：检查规则内容
      console.log('Rules:', autoReplyStrategy.rules.find(r => r.intent === 'greeting'));
      
      const reply = autoReplyStrategy.generateReplyByIntent('greeting', content, {});
      
      console.log('Generated reply:', reply);
      expect(reply).toBe('您好！'); // 从mockRulesData中的defaultReply
    });
    
    test('应该处理正则表达式错误', () => {
      // 添加包含无效正则的规则
      autoReplyStrategy.rules.push({
        intent: 'test_invalid',
        rules: [
          { pattern: '[invalid regex', reply: 'test' }
        ]
      });
      
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const reply = autoReplyStrategy.generateReplyByIntent('test_invalid', 'test', {});
      
      expect(console.error).toHaveBeenCalled();
      expect(reply).toBeNull();
    });
  });
  
  describe('generateDefaultReply 方法', () => {
    test('应该生成默认回复', () => {
      const result = autoReplyStrategy.generateDefaultReply('测试内容', {});
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.confidence).toBe(0.3);
      expect(result.intent).toBe('default');
      expect(result.shouldAutoSend).toBe(false);
    });
    
    test('应该随机选择默认回复', () => {
      const replies = new Set();
      
      // 多次调用收集不同的回复
      for (let i = 0; i < 20; i++) {
        const result = autoReplyStrategy.generateDefaultReply('测试', {});
        replies.add(result.message);
      }
      
      // 应该有多种不同的默认回复
      expect(replies.size).toBeGreaterThan(1);
    });
  });
  
  describe('replaceTemplateVariables 方法', () => {
    test('应该替换客户名称变量', () => {
      const template = '您好{customerName}，欢迎咨询！';
      const context = {
        customerInfo: { name: '张三' }
      };
      
      const result = autoReplyStrategy.replaceTemplateVariables(template, context);
      
      expect(result).toBe('您好张三，欢迎咨询！');
    });
    
    test('应该替换时间问候变量', () => {
      const template = '{timeGreeting}！有什么可以帮您？';
      const context = {};
      
      const result = autoReplyStrategy.replaceTemplateVariables(template, context);
      
      expect(result).toMatch(/^(上午好|下午好|晚上好|您好)！有什么可以帮您？$/);
    });
    
    test('应该替换消息计数变量', () => {
      const template = '这是您的第{messageCount}条消息。';
      const context = { messageCount: 5 };
      
      const result = autoReplyStrategy.replaceTemplateVariables(template, context);
      
      expect(result).toBe('这是您的第5条消息。');
    });
    
    test('应该使用默认值当上下文信息缺失时', () => {
      const template = '您好{customerName}！';
      const context = {};
      
      const result = autoReplyStrategy.replaceTemplateVariables(template, context);
      
      expect(result).toBe('您好亲！');
    });
    
    test('应该处理null或undefined模板', () => {
      expect(autoReplyStrategy.replaceTemplateVariables(null, {})).toBeNull();
      expect(autoReplyStrategy.replaceTemplateVariables(undefined, {})).toBeUndefined();
    });
    
    test('应该处理非字符串模板', () => {
      const result = autoReplyStrategy.replaceTemplateVariables(123, {});
      expect(result).toBe(123);
    });
    
    test('应该根据时间正确设置问候语', () => {
      const template = '{timeGreeting}';
      const context = {};
      
      // Mock Date对象来测试不同时间
      const originalDate = Date;
      
      // 测试上午
      global.Date = jest.fn(() => ({ getHours: () => 10 }));
      let result = autoReplyStrategy.replaceTemplateVariables(template, context);
      expect(result).toBe('上午好');
      
      // 测试下午
      global.Date = jest.fn(() => ({ getHours: () => 15 }));
      result = autoReplyStrategy.replaceTemplateVariables(template, context);
      expect(result).toBe('下午好');
      
      // 测试晚上
      global.Date = jest.fn(() => ({ getHours: () => 20 }));
      result = autoReplyStrategy.replaceTemplateVariables(template, context);
      expect(result).toBe('晚上好');
      
      // 恢复原始Date
      global.Date = originalDate;
    });
  });
  
  describe('addRule 方法', () => {
    test('应该成功添加新规则到现有意图', async () => {
      const result = await autoReplyStrategy.addRule('greeting', '.*早上好.*', '早上好！');
      
      expect(result).toBe(true);
      const greetingIntent = autoReplyStrategy.rules.find(r => r.intent === 'greeting');
      expect(greetingIntent.rules.some(rule => rule.pattern === '.*早上好.*')).toBe(true);
    });
    
    test('应该为新意图创建规则', async () => {
      const result = await autoReplyStrategy.addRule('new_intent', '.*测试.*', '测试回复');
      
      expect(result).toBe(true);
      const newIntent = autoReplyStrategy.rules.find(r => r.intent === 'new_intent');
      expect(newIntent).toBeDefined();
      expect(newIntent.rules[0].pattern).toBe('.*测试.*');
      expect(newIntent.rules[0].reply).toBe('测试回复');
    });
    
    test('应该验证正则表达式', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await autoReplyStrategy.addRule('test', '[invalid regex', '回复');
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
    
    test('当保存失败时应该返回false', async () => {
      jest.spyOn(autoReplyStrategy, 'saveRules').mockResolvedValue(false);
      
      const result = await autoReplyStrategy.addRule('test', '.*test.*', '回复');
      
      expect(result).toBe(false);
    });
  });
  
  describe('setReplyMode 方法', () => {
    test('应该成功设置有效的回复模式', () => {
      expect(autoReplyStrategy.setReplyMode('auto')).toBe(true);
      expect(autoReplyStrategy.replyMode).toBe('auto');
      
      expect(autoReplyStrategy.setReplyMode('suggest')).toBe(true);
      expect(autoReplyStrategy.replyMode).toBe('suggest');
      
      expect(autoReplyStrategy.setReplyMode('hybrid')).toBe(true);
      expect(autoReplyStrategy.replyMode).toBe('hybrid');
    });
    
    test('应该拒绝无效的回复模式', () => {
      const originalMode = autoReplyStrategy.replyMode;
      
      expect(autoReplyStrategy.setReplyMode('invalid')).toBe(false);
      expect(autoReplyStrategy.replyMode).toBe(originalMode);
      
      expect(autoReplyStrategy.setReplyMode('')).toBe(false);
      expect(autoReplyStrategy.replyMode).toBe(originalMode);
      
      expect(autoReplyStrategy.setReplyMode(null)).toBe(false);
      expect(autoReplyStrategy.replyMode).toBe(originalMode);
    });
  });
  
  describe('边界条件和错误处理', () => {
    test('应该处理非常长的消息内容', () => {
      const longContent = '你好'.repeat(1000);
      const processedResult = {
        parsedMessage: { cleanContent: longContent },
        intents: [{ intent: 'greeting', confidence: 0.8 }]
      };
      
      expect(() => autoReplyStrategy.process(processedResult, {})).not.toThrow();
    });
    
    test('应该处理特殊字符', () => {
      const content = '你好@#$%^&*()';
      const processedResult = {
        parsedMessage: { cleanContent: content },
        intents: [{ intent: 'greeting', confidence: 0.8 }]
      };
      
      expect(() => autoReplyStrategy.process(processedResult, {})).not.toThrow();
    });
    
    test('应该处理Unicode字符', () => {
      const content = '你好🙂世界👍';
      const processedResult = {
        parsedMessage: { cleanContent: content },
        intents: [{ intent: 'greeting', confidence: 0.8 }]
      };
      
      expect(() => autoReplyStrategy.process(processedResult, {})).not.toThrow();
    });
    
    test('应该处理循环引用的上下文', () => {
      const context = { customerInfo: {} };
      context.customerInfo.self = context; // 创建循环引用
      
      const processedResult = {
        parsedMessage: { cleanContent: '你好' },
        intents: [{ intent: 'greeting', confidence: 0.8 }]
      };
      
      expect(() => autoReplyStrategy.process(processedResult, context)).not.toThrow();
    });
  });
  
  describe('性能测试', () => {
    test('应该在合理时间内处理大量回复请求', () => {
      const processedResults = Array.from({length: 100}, (_, i) => ({
        parsedMessage: { cleanContent: `测试消息${i}你好` },
        intents: [{ intent: 'greeting', confidence: 0.8 }]
      }));
      
      const startTime = Date.now();
      
      processedResults.forEach(result => {
        autoReplyStrategy.process(result, {});
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100次处理应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });
  });
});