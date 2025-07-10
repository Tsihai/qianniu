/**
 * 消息处理器测试
 */
const MessageProcessor = require('../services/messageProcessor');

// 创建消息处理器实例
const processor = new MessageProcessor({
  enableLogging: true
});

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

// 监听处理完成事件
processor.on('message_processed', (result) => {
  console.log('\n===== 消息处理完成 =====');
  console.log(`原始消息: ${result.originalMessage.content}`);
  console.log(`客户端ID: ${result.originalMessage.clientId}`);
  
  if (result.bestIntent) {
    console.log(`识别意图: ${result.bestIntent.intent} (置信度: ${result.bestIntent.confidence.toFixed(2)})`);
  } else {
    console.log('未识别到明确意图');
  }
  
  console.log('关键词:', result.parsedMessage.keywords);
  
  if (result.bestReply) {
    console.log(`推荐回复: ${result.bestReply.text}`);
  } else {
    console.log('无推荐回复');
  }
  
  console.log('==========================\n');
});

// 处理测试消息
console.log('开始测试消息处理器...');

// 依次处理测试消息
function processTestMessages() {
  let index = 0;
  
  function processNext() {
    if (index < testMessages.length) {
      const message = testMessages[index++];
      console.log(`处理第 ${index} 条消息...`);
      processor.processMessage(message);
      
      // 延时处理下一条，模拟真实场景
      setTimeout(processNext, 1000);
    } else {
      console.log('所有测试消息处理完成');
      
      // 显示会话信息
      showSessionInfo();
    }
  }
  
  processNext();
}

// 显示会话信息
function showSessionInfo() {
  console.log('\n===== 会话信息 =====');
  
  for (const [sessionId, session] of processor.sessions.entries()) {
    console.log(`会话ID: ${sessionId}`);
    console.log(`消息数量: ${session.messageCount}`);
    console.log(`会话开始时间: ${new Date(session.startTime).toLocaleString()}`);
    console.log(`最后活动时间: ${new Date(session.lastActivityTime).toLocaleString()}`);
    console.log('历史意图:', session.history.map(h => h.intents).flat().join(', '));
    console.log('------------------------');
  }
  
  console.log('===================\n');
}

// 自定义测试消息
function testCustomMessage(content, clientId = 'test-client-custom') {
  const message = {
    type: 'chat',
    clientId,
    content,
    timestamp: Date.now()
  };
  
  console.log(`\n测试自定义消息: "${content}"`);
  processor.processMessage(message);
}

// 开始测试
processTestMessages();

// 测试自定义消息
setTimeout(() => {
  testCustomMessage('这个产品的尺寸是多大的？适合放在卧室吗？');
}, testMessages.length * 1000 + 1000);

// 测试清理过期会话
setTimeout(() => {
  console.log('\n测试清理过期会话...');
  processor.cleanupSessions(100); // 使用较小的超时时间进行测试
  console.log(`清理后剩余会话数: ${processor.sessions.size}`);
}, (testMessages.length + 2) * 1000); 