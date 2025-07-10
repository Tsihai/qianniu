/**
 * WebSocket服务单元测试
 */
const WebSocket = require('ws');
const assert = require('assert');
const config = require('../config');

// 测试配置
const TEST_PORT = 8082; // 专用测试端口
const TEST_URL = `ws://localhost:${TEST_PORT}`;
let wsClient = null;

// 覆盖配置
config.wsPort = TEST_PORT;

// 导入WebSocketService
const WebSocketService = require('../services/websocketService');

// 测试套件
console.log('===== WebSocket服务测试开始 =====');

// 创建服务实例
const wsService = new WebSocketService();

// 设置消息处理器 - 必须在初始化前设置
wsService.onMessageReceived = (clientId, message) => {
  console.log(`测试消息处理器收到消息:`, message);
  
  if (message.type === 'chat') {
    wsService.sendToClient(clientId, {
      type: 'chat',
      message: `服务器收到: ${message.content || ''}`,
      timestamp: Date.now()
    });
  }
};

// 测试1: 服务器启动
console.log('测试1: 服务器启动');
try {
  wsService.init();
  console.log('✅ 服务器启动成功');
} catch (error) {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
}

// 测试2: 客户端连接
console.log('\n测试2: 客户端连接');
const connectClient = () => {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(TEST_URL);
    
    client.on('open', () => {
      console.log('✅ 客户端连接成功');
      wsClient = client;
      resolve(client);
    });
    
    client.on('error', (error) => {
      console.error('❌ 客户端连接失败:', error.message);
      reject(error);
    });
    
    // 设置超时
    setTimeout(() => {
      if (client.readyState !== WebSocket.OPEN) {
        reject(new Error('连接超时'));
      }
    }, 5000);
  });
};

// 测试3: 消息发送和接收
const testMessageExchange = (client) => {
  console.log('\n测试3: 消息发送和接收');
  
  return new Promise((resolve, reject) => {
    // 监听消息
    client.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('收到消息:', message);
        
        if (message.type === 'chat' && message.message.includes('服务器收到')) {
          console.log('✅ 消息回显测试通过');
          resolve();
        }
      } catch (error) {
        console.error('消息解析错误:', error);
      }
    });
    
    // 发送测试消息
    const testMessage = {
      type: 'chat',
      content: '测试消息' + Date.now(),
      timestamp: Date.now()
    };
    
    client.send(JSON.stringify(testMessage));
    console.log('测试消息已发送:', testMessage);
    
    // 设置超时
    setTimeout(() => {
      reject(new Error('消息响应超时'));
    }, 5000);
  });
};

// 测试4: 广播功能
const testBroadcast = () => {
  console.log('\n测试4: 广播功能');
  
  // 创建另一个客户端用于接收广播
  const client2 = new WebSocket(TEST_URL);
  
  return new Promise((resolve, reject) => {
    let receivedCount = 0;
    const expectedCount = 2; // 两个客户端都应该收到广播
    
    const checkComplete = () => {
      receivedCount++;
      if (receivedCount >= expectedCount) {
        console.log('✅ 广播测试通过');
        resolve();
        client2.close();
      }
    };
    
    // 设置第一个客户端的消息处理
    wsClient.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'broadcast' && message.message === '广播测试') {
          console.log('客户端1收到广播');
          checkComplete();
        }
      } catch (error) {}
    });
    
    // 设置第二个客户端的消息处理
    client2.on('open', () => {
      client2.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'broadcast' && message.message === '广播测试') {
            console.log('客户端2收到广播');
            checkComplete();
          }
        } catch (error) {}
      });
      
      // 发送广播消息
      setTimeout(() => {
        wsService.broadcast({
          type: 'broadcast',
          message: '广播测试',
          timestamp: Date.now()
        });
        console.log('广播消息已发送');
      }, 1000);
    });
    
    // 设置超时
    setTimeout(() => {
      reject(new Error('广播响应超时'));
    }, 5000);
  });
};

// 清理函数
const cleanup = () => {
  console.log('\n===== 测试清理 =====');
  if (wsClient) {
    wsClient.close();
  }
  wsService.stop();
  console.log('服务已停止，测试完成');
};

// 运行所有测试
connectClient()
  .then(testMessageExchange)
  .then(testBroadcast)
  .then(() => {
    console.log('\n===== 所有测试通过 =====');
    cleanup();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error.message);
    cleanup();
    process.exit(1);
  }); 