/**
 * 业务逻辑处理器测试
 */
const BusinessLogicProcessor = require('../services/businessLogic');
const AutoReplyStrategy = require('../services/businessLogic/strategies/AutoReplyStrategy');
const StatisticsStrategy = require('../services/businessLogic/strategies/StatisticsStrategy');
const CustomerBehaviorStrategy = require('../services/businessLogic/strategies/CustomerBehaviorStrategy');

// 模拟消息处理器
const mockMessageProcessor = {
  parseMessage: (message) => {
    console.log('模拟解析消息:', message);
    return {
      cleanContent: message.content,
      keywords: message.content.split(' ')
    };
  },
  classifyIntent: (parsedMessage) => {
    console.log('模拟识别意图:', parsedMessage);
    return [{
      intent: '询问价格',
      confidence: 0.85
    }];
  },
  generateReply: (parsedMessage, intents) => {
    console.log('模拟生成回复:', intents);
    return {
      text: '这款产品的价格是99元，现在购买还有优惠活动哦！',
      confidence: 0.85,
      intent: intents[0].intent
    };
  },
  handleSession: (message) => {
    console.log('模拟处理会话:', message);
  }
};

// 模拟WebSocket服务
const mockWsService = {
  on: (event, handler) => {
    console.log(`模拟注册事件: ${event}`);
  },
  emit: (event, data) => {
    console.log(`模拟触发事件: ${event}`, data);
  },
  send: (client, message) => {
    console.log('模拟发送消息:', message);
  }
};

console.log('===== 业务逻辑处理器测试 =====');

// 创建业务逻辑处理器实例
console.log('\n创建业务逻辑处理器实例...');
const businessLogicProcessor = new BusinessLogicProcessor({
  messageProcessor: mockMessageProcessor,
  wsService: mockWsService
});

// 测试策略处理器初始化
console.log('\n测试策略处理器初始化...');
console.log(`策略处理器数量: ${Object.keys(businessLogicProcessor.strategies).length}`);
const strategyTypes = Object.keys(businessLogicProcessor.strategies);
console.log('策略类型:', strategyTypes);

// 测试消息处理
console.log('\n测试消息处理...');
const testMessage = {
  content: '你好，请问这个商品多少钱？',
  sender: 'user123',
  timestamp: Date.now()
};

// 模拟消息处理结果
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
  intents: [
    {
      intent: '询问价格',
      confidence: 0.85
    }
  ],
  timestamp: Date.now()
};

// 测试业务逻辑处理
console.log('\n测试业务逻辑处理...');
const businessResult = businessLogicProcessor.process(processedResult);
console.log('业务处理结果:', businessResult);

// 测试会话管理
console.log('\n测试会话上下文管理...');
const sessionContext = businessLogicProcessor.getSessionContext('user123');
console.log('会话上下文:', sessionContext);

// 测试自动回复策略
console.log('\n===== 自动回复策略测试 =====');
const autoReplyStrategy = businessLogicProcessor.strategies.autoReply;
console.log(`规则数量: ${autoReplyStrategy.rules.length}`);

// 测试自动回复生成
const mockParsedMessage = {
  cleanContent: '你好，请问这个商品多少钱？',
  keywords: ['你好', '商品', '多少钱']
};
const mockIntent = {
  intent: 'price_inquiry',
  confidence: 0.85
};
const reply = autoReplyStrategy.generateReplyByIntent(mockIntent.intent, mockParsedMessage.cleanContent, sessionContext);
console.log('自动回复结果:', reply);

// 测试默认回复生成
console.log('\n测试默认回复生成:');
const defaultReply = autoReplyStrategy.generateDefaultReply('无法识别的消息', sessionContext);
console.log('默认回复结果:', defaultReply);

// 测试统计分析策略
console.log('\n===== 统计分析策略测试 =====');
const statisticsStrategy = businessLogicProcessor.strategies.statistics;
console.log('初始统计数据:', statisticsStrategy.statistics);

// 更新统计数据
const statsResult = statisticsStrategy.process(processedResult, sessionContext);
console.log('统计处理结果:', statsResult);

// 测试客户行为分析策略
console.log('\n===== 客户行为分析策略测试 =====');
const customerBehaviorStrategy = businessLogicProcessor.strategies.customerBehavior;
console.log('初始客户数据:', customerBehaviorStrategy.customers);

// 更新客户行为数据
const behaviorResult = customerBehaviorStrategy.process(processedResult, sessionContext);
console.log('客户行为处理结果:', behaviorResult);

// 测试会话清理功能
console.log('\n测试会话清理...');
const cleanupCount = businessLogicProcessor.cleanupSessions(0); // 立即清理所有会话
console.log(`清理会话数: ${cleanupCount}`);

console.log('\n===== 测试完成 ====='); 