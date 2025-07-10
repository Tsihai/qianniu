/**
 * 千牛客服自动化系统
 * 主服务入口文件
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const websocketService = require('./services/websocketService');

// 创建Express应用
const app = express();

// 使用中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API路由
app.get('/', (req, res) => {
  res.json({
    name: '千牛客服自动化系统',
    version: '1.0.0',
    status: 'running',
    websocket: {
      status: websocketService.isRunning ? 'running' : 'stopped',
      port: config.wsPort,
      clientCount: websocketService.getClientCount()
    }
  });
});

// WebSocket状态API
app.get('/ws/status', (req, res) => {
  res.json({
    status: websocketService.isRunning ? 'running' : 'stopped',
    port: config.wsPort,
    clients: websocketService.getClientsInfo()
  });
});

// 广播消息API
app.post('/ws/broadcast', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '缺少消息内容' });
  }
  
  websocketService.broadcast({
    type: 'broadcast',
    message,
    timestamp: Date.now()
  });
  
  res.json({ success: true });
});

// 启动服务器
function startServer() {
  // 启动Express HTTP服务器
  app.listen(config.port, () => {
    console.log(`HTTP服务已启动，监听端口: ${config.port}`);
  });
  
  // 初始化WebSocket服务
  websocketService.init();
  websocketService.startHeartbeat();
  
  // 注册自定义消息处理器
  websocketService.onMessageReceived = (clientId, message) => {
    // 这里可以添加自定义的消息处理逻辑
    console.log(`收到客户端[${clientId}]的消息:`, message);
    
    // 简单的回显测试
    if (message.type === 'chat') {
      websocketService.sendToClient(clientId, {
        type: 'chat',
        message: `服务器收到: ${message.content || ''}`,
        timestamp: Date.now()
      });
    }
  };
  
  // 捕获进程退出信号
  process.on('SIGINT', () => {
    console.log('接收到退出信号，正在关闭服务...');
    websocketService.stop();
    process.exit(0);
  });
}

// 启动服务
startServer(); 