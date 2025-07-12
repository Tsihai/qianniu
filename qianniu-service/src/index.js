/**
 * 千牛客服消息处理系统
 * 主入口文件
 */
import path from 'path';
import WebSocketService from './services/websocketService.js';
import MessageProcessor from './services/messageProcessor/index.js';
import BusinessLogic from './services/businessLogic/index.js';
import DataService from './services/dataService.js';
import DataServiceFactory from './services/dataServiceFactory.js';
import { Logger } from './utils/Logger.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import SessionManager from './utils/SessionManager.js';
import { ConfigManager } from './config/ConfigManager.js';
import models from './models/index.js';

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

// 全局变量声明
let configManager;
let config;
let logger;
let wsService;
let dataService;
let messageProcessor;
let businessLogicProcessor;
let dataServiceFactory;

// 初始化系统配置
async function initializeConfig() {
  // 初始化配置管理器
  configManager = new ConfigManager();
  await configManager.initialize();

  // 获取配置项
  config = {
    websocket: {
      port: configManager.get('websocket.port', 8080),
      path: configManager.get('websocket.path', '/ws'),
      heartbeatInterval: configManager.get('websocket.heartbeatInterval', 30000),
      maxConnections: configManager.get('websocket.maxConnections', 1000),
      messageRateLimit: configManager.get('websocket.messageRateLimit', 100)
    },
    database: {
      host: configManager.get('database.host', 'localhost'),
      port: configManager.get('database.port', 3306),
      username: configManager.get('database.username', 'root'),
      password: configManager.get('database.password', ''),
      database: configManager.get('database.database', 'qianniu_service')
    },
    features: {
      autoReply: configManager.get('features.autoReply', false),
      statistics: configManager.get('features.statistics', true),
      customerBehavior: configManager.get('features.customerBehavior', true),
      performanceMonitoring: configManager.get('features.performanceMonitoring', true)
    },
    logging: {
      level: configManager.get('logging.level', 'info'),
      enableConsole: configManager.get('logging.enableConsole', true),
      enableFile: configManager.get('logging.enableFile', false),
      filePath: configManager.get('logging.filePath', './logs/app.log')
    }
   };

  // 初始化工具类
  logger = new Logger({
    level: config.logging.level,
    enableConsole: config.logging.enableConsole,
    enableFile: config.logging.enableFile,
    filePath: config.logging.filePath
  });

  // 将ConfigManager实例传递给Logger以便记录配置变更
  logger.info('配置管理器初始化完成', {
    environment: configManager.get('environment', 'development')
  });
}



// 启动系统
async function startSystem() {
  try {
    // 首先初始化配置
    await initializeConfig();
    
    logger.info('千牛客服消息处理系统启动中...', {
      version: '1.0.0',
      environment: configManager.get('environment', 'development'),
      config: {
        websocketPort: config.websocket.port,
        databaseHost: config.database.host,
        featuresEnabled: Object.keys(config.features).filter(key => config.features[key])
      }
    });

    // 初始化数据服务工厂
    console.log('初始化数据服务工厂...');
    dataServiceFactory = DataServiceFactory.getInstance();
    dataServiceFactory.initialize(configManager, logger);
    
    // 获取数据库配置并记录当前使用的数据库类型
    const dbConfig = configManager.getDatabaseConfig();
    const dbType = configManager.getDatabaseType();
    console.log(`数据库类型: ${dbType}`);
    logger.info('数据库配置加载完成', {
      type: dbType,
      config: dataServiceFactory.sanitizeConfig ? dataServiceFactory.sanitizeConfig(dbConfig) : dbConfig
    });
    
    // 创建数据服务实例
    console.log('创建数据服务实例...');
    dataService = await dataServiceFactory.createDataService();

    // 创建WebSocket服务
    console.log('准备创建WebSocketService - configManager:', configManager);
    console.log('准备创建WebSocketService - config.websocket:', config.websocket);
    
    wsService = new WebSocketService({
      port: config.websocket.port,
      path: config.websocket.path,
      heartbeatInterval: config.websocket.heartbeatInterval,
      maxConnections: config.websocket.maxConnections,
      messageRateLimit: config.websocket.messageRateLimit,
      enableProcessing: true,
      enablePerformanceMonitoring: config.features.performanceMonitoring,
      enableSessionManagement: true,
      autoReply: config.features.autoReply,
      logLevel: config.logging.level,
      configManager: configManager // 传递ConfigManager实例
    });

    // 创建消息处理器
    messageProcessor = new MessageProcessor({
      enableLogging: true,
      enablePerformanceMonitoring: config.features.performanceMonitoring,
      enableSessionManagement: true,
      logLevel: config.logging.level,
      configManager: configManager // 传递ConfigManager实例
    });

     // 创建业务逻辑处理器
     businessLogicProcessor = new BusinessLogic({
       enableLogging: true,
       enablePerformanceMonitoring: config.features.performanceMonitoring,
       enableSessionManagement: true,
       autoReplyEnabled: config.features.autoReply,
       statisticsEnabled: config.features.statistics,
       customerBehaviorEnabled: config.features.customerBehavior,
       logLevel: config.logging.level,
       configManager: configManager, // 传递ConfigManager实例
       dataService: dataService // 传递DataService实例
     });
     
     console.log(`千牛服务已启动，监听端口: ${config.websocket.port}`);
     console.log(`WebSocket地址: ws://localhost:${config.websocket.port}${config.websocket.path}`);
     console.log(`数据存储: ${dbType.toUpperCase()}`);
     
     // 记录服务启动成功
     logger.info('千牛服务启动成功', {
       port: config.websocket.port,
       path: config.websocket.path,
       databaseType: dbType,
       factoryStatus: dataServiceFactory.getStatus()
     });

    // 启动WebSocket服务
    console.log(`启动WebSocket服务，端口: ${config.websocket.port}, 路径: ${config.websocket.path}`);
    wsService.start();
    
    // 注册WebSocket事件处理
    setupWebSocketEventHandlers();
    
    console.log('=== 系统启动完成 ===');
  } catch (error) {
    console.error('系统启动失败:', error);
    if (logger) {
      logger.error('系统启动失败', {
        error: error.message,
        stack: error.stack
      });
    }
    process.exit(1);
  }
}

/**
 * 设置WebSocket事件处理
 */
function setupWebSocketEventHandlers() {
  // 处理客户端连接
  wsService.on('connection', (clientId) => {
    console.log(`客户端连接: ${clientId}`);
    
    // 如果启用了持久化，创建客户记录和会话
    if (config.enableDatabasePersistence) {
      dataService.getCustomer(clientId)
        .then(customer => {
          dataService.createSession(clientId, clientId);
        })
        .catch(error => {
          console.error(`创建客户记录失败: ${error.message}`);
        });
    }
  });
  
  // 处理消息
  wsService.on('message', (message, clientId) => {
    console.log(`收到来自 ${clientId} 的消息`);
    
    // 调用业务逻辑处理
    const result = wsService.processMessage(message, (processedResult) => {
      // 处理完成后，交由业务逻辑处理器处理
      businessLogicProcessor.process(processedResult);
      
      // 如果启用了数据持久化，保存消息
      if (config.enableDatabasePersistence) {
        dataService.addMessage(clientId, {
          content: message.content || '',
          type: message.type || 'chat',
          sender: 'client',
          timestamp: message.timestamp || Date.now(),
          metadata: {
            processedData: {
              intents: processedResult.intents?.map(i => ({ intent: i.intent, confidence: i.confidence }))
            }
          }
        }).catch(err => {
          console.error('保存消息失败:', err);
        });
      }
    });
  });
  
  // 处理业务逻辑处理结果
  businessLogicProcessor.on('business_processed', (result) => {
    // 如果有自动回复，且配置为自动发送
    if (result.autoReply && result.autoReply.shouldAutoSend) {
      const clientId = result.sessionId;
      
      // 发送自动回复
      wsService.sendTo(clientId, {
        type: 'chat',
        content: result.autoReply.message,
        isAutoReply: true,
        timestamp: Date.now()
      });
      
      // 如果启用了数据持久化，保存自动回复消息
      if (config.enableDatabasePersistence) {
        dataService.addMessage(clientId, {
          content: result.autoReply.message,
          type: 'chat',
          sender: 'system',
          timestamp: Date.now(),
          metadata: {
            autoReply: true,
            intent: result.autoReply.intent
          }
        }).catch(err => {
          console.error('保存自动回复消息失败:', err);
        });
      }
    }
  });
  
  // 处理断开连接
  wsService.on('disconnection', (clientId) => {
    console.log(`客户端断开连接: ${clientId}`);
    
    // 如果启用了持久化，关闭会话
    if (config.enableDatabasePersistence) {
      dataService.closeSession(clientId).catch(error => {
        console.error(`关闭会话失败: ${error.message}`);
      });
    }
  });
}

// 处理退出信号
process.on('SIGINT', async () => {
  console.log('接收到退出信号，正在关闭服务...');
  
  try {
    // 关闭WebSocket服务
    if (wsService) {
      wsService.stop();
      console.log('WebSocket服务已关闭');
    }
    
    // 销毁数据服务工厂
    if (dataServiceFactory) {
      dataServiceFactory.destroy();
      console.log('数据服务工厂已销毁');
    }
    
    // 销毁配置管理器
    if (configManager) {
      configManager.destroy();
      console.log('配置管理器已销毁');
    }
    
    console.log('服务已安全关闭');
  } catch (error) {
    console.error('关闭服务时出错:', error);
    if (logger) {
      logger.error('关闭服务时出错', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  process.exit(0);
});

// 启动服务
startSystem();