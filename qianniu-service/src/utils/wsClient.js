/**
 * WebSocket客户端测试工具
 * 用于测试WebSocket服务器的连接与消息
 */
const WebSocket = require('ws');
const readline = require('readline');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 客户端配置
const config = {
  url: process.env.WS_URL || 'ws://localhost:8081',
  reconnectInterval: 3000, // 重连间隔(毫秒)
  maxReconnectAttempts: 10 // 最大重连次数
};

let ws = null;
let reconnectCount = 0;
let clientId = null;

// 连接WebSocket服务器
function connect() {
  console.log(`正在连接到 ${config.url}...`);
  
  ws = new WebSocket(config.url);
  
  // 监听连接打开事件
  ws.on('open', () => {
    console.log('连接成功');
    reconnectCount = 0; // 重置重连计数
    
    // 注册客户端信息
    sendMessage({
      type: 'register',
      data: {
        name: '测试客户端',
        version: '1.0.0'
      }
    });
    
    // 启动命令行交互
    startCommandLine();
  });
  
  // 监听消息事件
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // 保存服务器分配的客户端ID
      if (message.type === 'system' && message.action === 'welcome' && message.clientId) {
        clientId = message.clientId;
        console.log(`服务器分配的客户端ID: ${clientId}`);
      }
      
      console.log(`收到消息: ${data}`);
    } catch (error) {
      console.error('解析消息错误:', error);
      console.log('原始消息:', data);
    }
  });
  
  // 监听错误事件
  ws.on('error', (error) => {
    console.error('连接错误:', error.message);
  });
  
  // 监听关闭事件
  ws.on('close', () => {
    console.log('连接已关闭');
    
    // 尝试重新连接
    if (reconnectCount < config.maxReconnectAttempts) {
      reconnectCount++;
      console.log(`尝试重新连接 (${reconnectCount}/${config.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        connect();
      }, config.reconnectInterval);
    } else {
      console.log('达到最大重连次数，停止重连');
      process.exit(1);
    }
  });
}

// 发送消息
function sendMessage(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// 启动命令行交互
function startCommandLine() {
  console.log('\n可用命令:');
  console.log('send <消息内容> - 发送聊天消息');
  console.log('ping - 发送ping消息');
  console.log('quit - 关闭连接并退出');
  console.log('status - 显示连接状态');
  
  rl.on('line', (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'send':
        const content = args.slice(1).join(' ');
        if (content) {
          const success = sendMessage({
            type: 'chat',
            content,
            timestamp: Date.now()
          });
          
          if (success) {
            console.log(`已发送消息: ${content}`);
          } else {
            console.log('发送失败，连接可能已关闭');
          }
        } else {
          console.log('请提供消息内容');
        }
        break;
        
      case 'ping':
        const success = sendMessage({
          type: 'ping',
          timestamp: Date.now()
        });
        
        if (success) {
          console.log('已发送ping消息');
        } else {
          console.log('发送失败，连接可能已关闭');
        }
        break;
        
      case 'quit':
        console.log('正在关闭连接...');
        ws.close();
        rl.close();
        setTimeout(() => {
          process.exit(0);
        }, 1000);
        break;
        
      case 'status':
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.log(`连接状态: ${states[ws.readyState]}`);
        console.log(`客户端ID: ${clientId || '未分配'}`);
        break;
        
      default:
        console.log('未知命令，可用命令:');
        console.log('send <消息内容> - 发送聊天消息');
        console.log('ping - 发送ping消息');
        console.log('quit - 关闭连接并退出');
        console.log('status - 显示连接状态');
    }
  });
}

// 启动客户端
connect(); 