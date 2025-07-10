/**
 * 千牛客服自动化服务 - 主入口文件
 * 用于启动WebSocket服务和RESTful API服务
 */
const express = require('express');
const cors = require('cors');
const WebSocketService = require('./services/websocketService');
const config = require('./config');

// 创建Express应用
const app = express();

// 启用中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建WebSocket服务实例
const wsService = new WebSocketService({
  port: config.wsPort || 8080,
  path: '/ws',
  heartbeatInterval: 30000,
  enableProcessing: true,
  autoReply: false, // 初始不启用自动回复
  processorOptions: {
    enableLogging: true
  }
});

// 启动WebSocket服务
wsService.start();

// 设置API路由
// 状态接口
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    clients: wsService.getClientCount(),
    uptime: process.uptime()
  });
});

// 客户端列表接口
app.get('/api/clients', (req, res) => {
  res.json({
    count: wsService.getClientCount(),
    clients: wsService.getClientList()
  });
});

// 发送消息接口
app.post('/api/message', (req, res) => {
  const { clientId, message } = req.body;
  
  if (!clientId || !message) {
    return res.status(400).json({ error: '缺少clientId或message参数' });
  }
  
  const success = wsService.sendTo(clientId, message);
  
  res.json({
    success,
    timestamp: Date.now()
  });
});

// 广播消息接口
app.post('/api/broadcast', (req, res) => {
  const { message, exclude } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '缺少message参数' });
  }
  
  const count = wsService.broadcast(message, exclude || []);
  
  res.json({
    success: true,
    recipients: count,
    timestamp: Date.now()
  });
});

// 消息处理测试接口
app.post('/api/process-message', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '缺少message参数' });
  }
  
  try {
    const processor = wsService.getMessageProcessor();
    
    if (!processor) {
      return res.status(500).json({ error: '消息处理器未启用' });
    }
    
    const result = processor.processMessage(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取/设置自动回复状态接口
app.route('/api/auto-reply')
  .get((req, res) => {
    res.json({ enabled: wsService.options.autoReply });
  })
  .post((req, res) => {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '参数错误，enabled必须是布尔值' });
    }
    
    wsService.options.autoReply = enabled;
    res.json({ success: true, enabled });
  });

// 监听WebSocket事件
wsService.on('message_processed', (result) => {
  console.log(`消息处理完成: ${result.parsedMessage.cleanContent}`);
  // 这里可以添加其他处理逻辑
});

// 启动HTTP服务器
const server = app.listen(config.httpPort, () => {
  console.log(`REST API服务已启动，端口: ${config.httpPort}`);
  console.log(`WebSocket服务已启动，端口: ${config.wsPort}`);
  console.log('服务就绪，等待客户端连接...');
});

// 处理进程退出
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，关闭服务...');
  server.close(() => {
    wsService.stop();
    console.log('服务已安全关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，关闭服务...');
  server.close(() => {
    wsService.stop();
    console.log('服务已安全关闭');
    process.exit(0);
  });
}); 