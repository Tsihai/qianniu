/**
 * WebSocket服务测试
 */
const WebSocket = require('ws');
const WebSocketService = require('../services/websocketService');

// 测试配置
const TEST_PORT = 3001;
const TEST_PATH = '/ws';

// 创建WebSocket服务实例
const wsService = new WebSocketService({
  port: TEST_PORT,
  path: TEST_PATH
});

// 启动服务
console.log('启动WebSocket服务...');
wsService.start();

// 监听事件
wsService.on('connection', (client) => {
  console.log('客户端连接成功');
});

wsService.on('message', (message, client) => {
  console.log('收到消息:', message);
  
  // 回复消息
  wsService.send(client, {
    type: 'reply',
    content: `收到您的消息: ${message.content}`
  });
});

wsService.on('close', (client) => {
  console.log('客户端断开连接');
});

// 创建测试客户端
console.log('创建测试客户端...');
const wsClient = new WebSocket(`ws://localhost:${TEST_PORT}${TEST_PATH}`);

// 客户端事件
wsClient.on('open', () => {
  console.log('客户端连接成功');
  
  // 发送测试消息
  const testMessage = {
    type: 'chat',
    content: '你好，这是一条测试消息',
    sender: 'testUser'
  };
  
  console.log('发送测试消息:', testMessage);
  wsClient.send(JSON.stringify(testMessage));
});

wsClient.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('收到服务器消息:', message);
    
    // 测试完成后关闭连接
    setTimeout(() => {
      console.log('测试完成，关闭连接');
      wsClient.close();
      
      // 延迟关闭服务器，确保所有消息都处理完毕
      setTimeout(() => {
        console.log('关闭WebSocket服务');
        wsService.stop();
        
        // 如果在Jest环境中，通知测试完成
        if (typeof global.testDone === 'function') {
          global.testDone();
        }
      }, 500);
    }, 1000);
  } catch (error) {
    console.error('解析消息失败:', error);
  }
});

wsClient.on('error', (error) => {
  console.error('客户端错误:', error);
});

wsClient.on('close', () => {
  console.log('客户端连接已关闭');
});

// 使用Jest框架进行单元测试
if (typeof jest !== 'undefined') {
  describe('WebSocketService', () => {
    let service;
    let client;
    
    beforeAll((done) => {
      // 创建服务
      service = new WebSocketService({
        port: TEST_PORT + 1,
        path: TEST_PATH
      });
      
      // 启动服务
      service.start();
      
      // 设置事件处理
      service.on('message', (message, clientObj) => {
        service.send(clientObj, {
          type: 'reply',
          content: `收到消息: ${message.content}`
        });
      });
      
      // 等待服务启动
      setTimeout(done, 500);
    });
    
    afterAll((done) => {
      // 关闭服务
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
      
      service.stop();
      setTimeout(done, 500);
    });
    
    test('应该能够启动服务并接受连接', (done) => {
      client = new WebSocket(`ws://localhost:${TEST_PORT + 1}${TEST_PATH}`);
      
      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });
    
    test('应该能够发送和接收消息', (done) => {
      if (!client || client.readyState !== WebSocket.OPEN) {
        client = new WebSocket(`ws://localhost:${TEST_PORT + 1}${TEST_PATH}`);
        
        client.on('open', () => {
          runTest();
        });
      } else {
        runTest();
      }
      
      function runTest() {
        const testMessage = {
          type: 'chat',
          content: '测试消息',
          sender: 'testUser'
        };
        
        client.send(JSON.stringify(testMessage));
        
        client.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response).toBeDefined();
          expect(response.type).toBe('reply');
          expect(response.content).toContain('测试消息');
          done();
        });
      }
    });
    
    test('应该能够广播消息给所有客户端', (done) => {
      // 创建另一个客户端
      const client2 = new WebSocket(`ws://localhost:${TEST_PORT + 1}${TEST_PATH}`);
      
      client2.on('open', () => {
        // 广播消息
        service.broadcast({
          type: 'broadcast',
          content: '广播测试'
        });
        
        let receivedCount = 0;
        const messageHandler = () => {
          receivedCount++;
          if (receivedCount >= 2) {
            client2.close();
            done();
          }
        };
        
        client.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response.type).toBe('broadcast');
          messageHandler();
        });
        
        client2.once('message', (data) => {
          const response = JSON.parse(data);
          expect(response.type).toBe('broadcast');
          messageHandler();
        });
      });
    });
  });
} 