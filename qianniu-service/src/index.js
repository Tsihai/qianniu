/**
 * 千牛客服自动化系统主入口
 */
const WebSocket = require('ws');
const path = require('path');
const express = require('express');
const WebSocketService = require('./services/WebSocketService');
const MessageProcessor = require('./services/messageProcessor');
const BusinessLogicProcessor = require('./services/businessLogic');

// 初始化配置
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

// 初始化Express应用
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化消息处理器
const messageProcessor = new MessageProcessor({
  dataPath: path.join(__dirname, 'services/messageProcessor/data'),
  enableLogging: true
});

// 初始化业务逻辑处理器
const businessLogic = new BusinessLogicProcessor({
  dataPath: path.join(__dirname, 'services/businessLogic/data'),
  enableLogging: true,
  autoReplyEnabled: true
});

// 初始化WebSocket服务
const wsService = new WebSocketService({
  port: WS_PORT,
  pingInterval: 30000,
  autoReconnect: true
});

// 设置WebSocket消息处理
wsService.on('message', async (message, clientId) => {
  try {
    console.log(`收到消息 [${clientId}]: ${message.slice(0, 100)}...`);
    
    // 处理消息
    const processedResult = await messageProcessor.process(message, { clientId });
    
    // 应用业务逻辑
    const businessResult = businessLogic.process(processedResult);
    
    console.log(`处理结果 [${clientId}]:`, {
      intent: processedResult.bestIntent?.intent,
      confidence: processedResult.bestIntent?.confidence,
      autoReply: businessResult.autoReply?.message?.slice(0, 100)
    });
    
    // 如果配置为自动回复，且有回复内容，则发送
    if (
      businessResult.autoReply && 
      businessResult.autoReply.success && 
      businessResult.autoReply.shouldAutoSend
    ) {
      wsService.sendMessage({
        type: 'auto_reply',
        content: businessResult.autoReply.message,
        timestamp: Date.now(),
        clientId
      }, clientId);
    }
    
    // 发送处理结果通知给管理界面
    wsService.broadcast({
      type: 'message_processed',
      clientId,
      timestamp: Date.now(),
      result: {
        intent: processedResult.bestIntent?.intent,
        confidence: processedResult.bestIntent?.confidence,
        keywords: processedResult.parsedMessage?.keywords,
        suggestedReply: businessResult.autoReply?.message || null,
        statistics: businessResult.statistics,
        customerInfo: businessResult.behavior?.customerInfo
      }
    }, [clientId]); // 排除发送消息的客户端
  } catch (error) {
    console.error(`处理消息出错 [${clientId}]:`, error);
    wsService.sendMessage({
      type: 'error',
      content: '消息处理失败，请稍后重试',
      timestamp: Date.now(),
      error: error.message
    }, clientId);
  }
});

// 监听连接事件
wsService.on('connection', (clientId) => {
  console.log(`客户端连接 [${clientId}]`);
  wsService.sendMessage({
    type: 'welcome',
    content: '欢迎连接千牛客服自动化系统',
    timestamp: Date.now(),
    clientId
  }, clientId);
});

// 监听断开连接事件
wsService.on('disconnect', (clientId) => {
  console.log(`客户端断开连接 [${clientId}]`);
  // 清理相关资源
});

// API路由定义

// 获取消息统计数据
app.get('/api/statistics', (req, res) => {
  const type = req.query.type || 'global';
  const stats = businessLogic.strategies.statistics.getStatistics(type);
  res.json({ success: true, statistics: stats });
});

// 获取会话列表
app.get('/api/sessions', (req, res) => {
  const sessions = businessLogic.getAllSessions();
  res.json({ success: true, sessions });
});

// 获取会话详情
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = businessLogic.getSessionDetail(sessionId);
  
  if (!session) {
    return res.status(404).json({ success: false, message: '会话不存在' });
  }
  
  res.json({ success: true, session });
});

// 设置自动回复状态
app.post('/api/settings/auto-reply', (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  
  const result = businessLogic.setAutoReplyEnabled(enabled);
  res.json({ success: true, autoReplyEnabled: result });
});

// 添加自定义回复规则
app.post('/api/reply-rules', (req, res) => {
  const { intent, pattern, reply } = req.body;
  
  if (!intent || !pattern || !reply) {
    return res.status(400).json({ success: false, message: '参数不完整' });
  }
  
  try {
    const result = businessLogic.strategies.autoReply.addRule(intent, pattern, reply);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 设置回复模式
app.post('/api/settings/reply-mode', (req, res) => {
  const { mode } = req.body;
  
  if (!['auto', 'suggest', 'hybrid'].includes(mode)) {
    return res.status(400).json({ success: false, message: '无效的模式' });
  }
  
  const result = businessLogic.strategies.autoReply.setReplyMode(mode);
  res.json({ success: result, mode });
});

// 清理过期会话
app.post('/api/sessions/cleanup', (req, res) => {
  const { maxAge } = req.body;
  const ageInMs = maxAge ? parseInt(maxAge) * 1000 : 7200000; // 默认2小时
  
  const count = businessLogic.cleanupSessions(ageInMs);
  res.json({ success: true, cleanedCount: count });
});

// 启动HTTP服务器
app.listen(PORT, () => {
  console.log(`HTTP服务器运行在端口 ${PORT}`);
});

// 启动WebSocket服务器
wsService.start();

// 进程退出处理
process.on('SIGINT', () => {
  console.log('正在关闭服务...');
  wsService.stop();
  
  // 保存数据
  businessLogic.strategies.statistics.dispose();
  businessLogic.strategies.customerBehavior.dispose();
  
  process.exit(0);
}); 