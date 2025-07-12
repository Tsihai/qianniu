/**
 * 连接池监控功能测试
 */
const DataServiceFactory = require('../services/dataServiceFactory');
const { ConfigManager } = require('../config/ConfigManager');
const { Logger } = require('../utils/Logger');

describe('连接池监控功能测试', () => {
  let configManager;
  let factory;
  let logger;
  
  beforeAll(async () => {
    // 初始化配置管理器
    configManager = ConfigManager.getInstance();
    await configManager.initialize({
      env: 'development',
      enableWatcher: false
    });
    
    // 创建DataServiceFactory实例
    factory = DataServiceFactory.getInstance();
    logger = new Logger({ module: 'ConnectionPoolTest' });
    factory.initialize(configManager, logger);
  });
  
  afterAll(() => {
    // 清理资源
    if (factory) {
      factory.destroy();
    }
  });
  
  test('应该能够获取连接池监控配置', () => {
     const poolConfig = configManager.get('performance.connectionPool');
     expect(poolConfig).toBeDefined();
     console.log('连接池监控配置:', JSON.stringify(poolConfig, null, 2));
   });
  
  test('应该能够创建数据服务实例并获取连接池统计', async () => {
    const mongoService = await factory.createDataService('mongodb');
    const sqliteService = await factory.createDataService('sqlite');
    
    expect(mongoService).toBeDefined();
    expect(sqliteService).toBeDefined();
    
    const mongoStats = mongoService.getConnectionPoolStats();
    const sqliteStats = sqliteService.getConnectionPoolStats();
    
    expect(mongoStats).toBeDefined();
    expect(sqliteStats).toBeDefined();
    
    console.log('MongoDB连接池统计:', mongoStats);
    console.log('SQLite连接池统计:', sqliteStats);
  });
  
  test('应该能够进行连接池健康检查', async () => {
    const mongoService = await factory.createDataService('mongodb');
    const sqliteService = await factory.createDataService('sqlite');
    
    const mongoHealth = await mongoService.getConnectionPoolHealth();
    const sqliteHealth = await sqliteService.getConnectionPoolHealth();
    
    expect(mongoHealth).toBeDefined();
    expect(sqliteHealth).toBeDefined();
    
    console.log('MongoDB连接池健康状态:', mongoHealth);
    console.log('SQLite连接池健康状态:', sqliteHealth);
  });
  
  test('应该能够收集连接池监控指标', async () => {
    expect(() => {
      factory.collectConnectionPoolMetrics();
    }).not.toThrow();
    
    // 等待监控数据收集
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});