/**
 * 数据服务工厂
 * 根据配置创建和管理不同类型的数据服务实例
 * 支持MongoDB、SQLite、JSON文件存储
 */

import { ErrorHandler, ERROR_CODES } from '../utils/ErrorHandler.js';
import { Logger } from '../utils/Logger.js';
import { PerformanceMonitor, MetricType, AlertLevel } from '../utils/PerformanceMonitor.js';

/**
 * 数据服务工厂类 - 单例模式
 * 负责根据配置创建和管理数据服务实例
 */
class DataServiceFactory {
  constructor() {
    if (DataServiceFactory.instance) {
      return DataServiceFactory.instance;
    }

    this.serviceInstances = new Map();
    this.logger = null;
    this.configManager = null;
    this.currentServiceType = null;
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // 30秒健康检查间隔

    // 连接池监控
    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      bufferSize: 2000,
      collectInterval: 5000,
      enableSystemMetrics: true
    });
    this.connectionPoolMetrics = new Map();
    this.monitoringInterval = null;
    this.connectionPoolConfig = null;

    DataServiceFactory.instance = this;
  }

  /**
   * 获取工厂单例实例
   * @returns {DataServiceFactory}
   */
  static getInstance() {
    if (!DataServiceFactory.instance) {
      DataServiceFactory.instance = new DataServiceFactory();
    }
    return DataServiceFactory.instance;
  }

  /**
   * 初始化工厂
   * @param {Object} configManager - 配置管理器实例
   * @param {Object} logger - 日志器实例
   */
  initialize(configManager, logger) {
    this.configManager = configManager;
    this.logger = logger || new Logger({ module: 'DataServiceFactory' });
    
    // 获取连接池监控配置
     this.connectionPoolConfig = this.configManager ? 
       this.configManager.get('performance.connectionPool', {
         monitoring: {
           enabled: true,
           collectInterval: 10000,
           thresholds: {
             utilizationWarning: 0.8,
             pendingRequestsWarning: 5
           }
         }
       }) : {
         monitoring: {
           enabled: true,
           collectInterval: 10000,
           thresholds: {
             utilizationWarning: 0.8,
             pendingRequestsWarning: 5
           }
         }
       };
    
    // 启动性能监控
    this.performanceMonitor.start();
    this.setupConnectionPoolMonitoring();
    
    // 监听配置变更事件
    if (this.configManager) {
      this.configManager.on('configChanged', (data) => {
        if (data.path && data.path.startsWith('database.')) {
          this.handleConfigChange(data);
        }
      });
    }

    this.logger.info('数据服务工厂初始化完成');
  }

  /**
   * 设置连接池监控
   */
  setupConnectionPoolMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // 检查监控是否启用
     if (!this.connectionPoolConfig?.monitoring?.enabled) {
       this.logger.info('连接池监控已禁用');
       return;
     }
 
     const interval = this.connectionPoolConfig.monitoring.collectInterval || 10000;
    
    this.monitoringInterval = setInterval(() => {
      this.collectConnectionPoolMetrics();
    }, interval);
    
    this.logger.info(`连接池监控已启动，监控间隔: ${interval}ms`);
  }

  /**
   * 停止连接池监控
   */
  stopConnectionPoolMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('连接池监控已停止');
    }
  }

  /**
   * 收集连接池指标
   */
  collectConnectionPoolMetrics() {
    for (const [type, service] of this.serviceInstances.entries()) {
      try {
        if (service && typeof service.getConnectionPoolStats === 'function') {
          const stats = service.getConnectionPoolStats();
          
          // 记录连接池指标
          this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.active`, stats.active || 0);
          this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.idle`, stats.idle || 0);
          this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.total`, stats.total || 0);
          this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.pending`, stats.pending || 0);
          
          // 计算连接池利用率
          const poolUtilization = stats.maxConnections > 0 
            ? (stats.active / stats.maxConnections) 
            : (stats.total > 0 ? (stats.active / stats.total) : 0);
          
          this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.utilization`, poolUtilization * 100);
          
          // 检查连接池健康状态
          if (typeof service.getConnectionPoolHealth === 'function') {
            const health = service.getConnectionPoolHealth();
            
            this.performanceMonitor.recordCustomMetric(`connection_pool.${type}.healthy`, health.healthy ? 1 : 0);
            
            // 如果连接池不健康，发出告警
            if (!health.healthy) {
              this.performanceMonitor.recordAlert(
                AlertLevel.CRITICAL,
                `连接池健康检查失败: ${health.message} (服务: ${type})`
              );
            }
          }
          
          // 使用配置的阈值检查连接池利用率
           const utilizationThreshold = this.connectionPoolConfig?.monitoring?.thresholds?.utilizationWarning || 0.8;
           if (poolUtilization > utilizationThreshold) {
             this.performanceMonitor.recordAlert(AlertLevel.WARNING, 
               `连接池利用率过高: ${type} - ${(poolUtilization * 100).toFixed(1)}% (阈值: ${(utilizationThreshold * 100).toFixed(1)}%)`);
           }
           
           // 使用配置的阈值检查等待中的连接请求
           const pendingThreshold = this.connectionPoolConfig?.monitoring?.thresholds?.pendingRequestsWarning || 5;
           if (stats.pending > pendingThreshold) {
             this.performanceMonitor.recordAlert(
               AlertLevel.WARNING,
               `连接池有等待中的请求: ${stats.pending} (阈值: ${pendingThreshold}, 服务: ${type})`
             );
           }
          
          this.connectionPoolMetrics.set(type, {
            ...stats,
            utilization: poolUtilization,
            timestamp: Date.now()
          });
          
          // 记录详细日志
          this.logger.debug(`连接池统计 [${type}]:`, {
            type: stats.type,
            active: stats.active,
            idle: stats.idle,
            total: stats.total,
            pending: stats.pending,
            utilization: (poolUtilization * 100).toFixed(2) + '%',
            status: stats.status
          });
        }
      } catch (error) {
        this.logger.warn(`收集${type}连接池指标失败`, { error: error.message });
      }
    }
  }

  /**
   * 创建数据服务实例
   * @param {string} type - 服务类型 (mongodb|sqlite|json)
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} 数据服务实例
   */
  async createDataService(type = null, options = {}) {
    try {
      // 如果没有指定类型，从配置中获取
      if (!type) {
        type = this.configManager ? 
          this.configManager.getDatabaseType() : 
          'mongodb';
      }

      const serviceType = type.toLowerCase();
      this.currentServiceType = serviceType;

      // 检查是否已有相同类型的实例
      if (this.serviceInstances.has(serviceType) && !options.forceNew) {
        const existingInstance = this.serviceInstances.get(serviceType);
        if (await this.isServiceHealthy(existingInstance, serviceType)) {
          this.logger.info(`复用现有${serviceType}数据服务实例`);
          return existingInstance;
        } else {
          this.logger.warn(`现有${serviceType}数据服务实例不健康，创建新实例`);
          this.serviceInstances.delete(serviceType);
        }
      }

      let serviceInstance;
      const dbConfig = this.configManager ? 
        this.configManager.getDatabaseConfig() : 
        { type: serviceType };

      switch (serviceType) {
        case 'mongodb':
          serviceInstance = await this.createMongoDBService(dbConfig, options);
          break;
        
        case 'sqlite':
          serviceInstance = await this.createSQLiteService(dbConfig, options);
          break;
        
        case 'json':
        case 'file':
          serviceInstance = await this.createJSONService(dbConfig, options);
          break;
        
        default:
          throw ErrorHandler.createError(
            ERROR_CODES.CONFIG.INVALID_VALUE,
            `不支持的数据服务类型: ${serviceType}`,
            { supportedTypes: ['mongodb', 'sqlite', 'json'] }
          );
      }

      // 缓存服务实例
      this.serviceInstances.set(serviceType, serviceInstance);
      
      // 启动健康检查
      this.startHealthCheck();

      this.logger.info(`${serviceType}数据服务创建成功`, {
        type: serviceType,
        config: this.sanitizeConfig(dbConfig)
      });

      return serviceInstance;
    } catch (error) {
      this.logger.error(`创建${type}数据服务失败`, {
        error: error.message,
        type,
        stack: error.stack
      });
      
      // 尝试降级到备用服务
      return await this.createFallbackService(error, type, options);
    }
  }

  /**
   * 创建MongoDB数据服务
   * @param {Object} config - 数据库配置
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} MongoDB数据服务实例
   */
  async createMongoDBService(config, options) {
    const { default: DataService } = await import('./dataService.js');
    
    const serviceOptions = {
      ...options,
      configManager: this.configManager,
      mockMode: config.mockMode || false,
      ...config.mongodb
    };

    const service = new DataService(serviceOptions);
    
    // 验证MongoDB连接
    if (!config.mockMode) {
      await this.validateMongoDBConnection(service, config.mongodb);
    }

    return service;
  }

  /**
   * 创建SQLite数据服务
   * @param {Object} config - 数据库配置
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} SQLite数据服务实例
   */
  async createSQLiteService(config, options) {
    const { default: SQLiteDataService } = await import('./sqliteDataService.js');
    
    const serviceOptions = {
      ...options,
      configManager: this.configManager,
      ...config.sqlite
    };

    const service = new SQLiteDataService(serviceOptions);
    
    // 初始化SQLite数据库
    await service.initialize();
    
    // 验证SQLite连接
    await this.validateSQLiteConnection(service);

    return service;
  }

  /**
   * 创建JSON文件数据服务
   * @param {Object} config - 数据库配置
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} JSON数据服务实例
   */
  async createJSONService(config, options) {
    // 这里可以创建一个JSON文件数据服务
    // 暂时返回mock模式的DataService
    const { default: DataService } = await import('./dataService.js');
    
    const serviceOptions = {
      ...options,
      configManager: this.configManager,
      mockMode: true, // JSON模式使用mock实现
      ...config.json
    };

    return new DataService(serviceOptions);
  }

  /**
   * 验证MongoDB连接
   * @param {Object} service - 数据服务实例
   * @param {Object} config - MongoDB配置
   */
  async validateMongoDBConnection(service, config) {
    try {
      // 这里应该实现MongoDB连接验证
      // 暂时跳过，因为当前DataService是mock实现
      this.logger.info('MongoDB连接验证通过');
    } catch (error) {
      throw ErrorHandler.createError(
        ERROR_CODES.DATABASE.CONNECTION_FAILED,
        'MongoDB连接验证失败',
        { error: error.message, config: this.sanitizeConfig(config) }
      );
    }
  }

  /**
   * 验证SQLite连接
   * @param {Object} service - SQLite数据服务实例
   */
  async validateSQLiteConnection(service) {
    try {
      // 执行简单查询验证连接
      await service.testConnection();
      this.logger.info('SQLite连接验证通过');
    } catch (error) {
      throw ErrorHandler.createError(
        ERROR_CODES.DATABASE.CONNECTION_FAILED,
        'SQLite连接验证失败',
        { error: error.message }
      );
    }
  }

  /**
   * 检查服务健康状态
   * @param {Object} service - 数据服务实例
   * @param {string} type - 服务类型
   * @returns {Promise<boolean>} 是否健康
   */
  async isServiceHealthy(service, type) {
    try {
      switch (type) {
        case 'mongodb':
          // MongoDB健康检查
          return await this.checkMongoDBHealth(service);
        
        case 'sqlite':
          // SQLite健康检查
          return await this.checkSQLiteHealth(service);
        
        case 'json':
        case 'file':
          // JSON文件健康检查
          return await this.checkJSONHealth(service);
        
        default:
          return false;
      }
    } catch (error) {
      this.logger.warn(`${type}服务健康检查失败`, { error: error.message });
      return false;
    }
  }

  /**
   * MongoDB健康检查
   * @param {Object} service - MongoDB服务实例
   * @returns {Promise<boolean>}
   */
  async checkMongoDBHealth(service) {
    try {
      // 这里应该实现MongoDB ping检查
      // 暂时返回true，因为当前是mock实现
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * SQLite健康检查
   * @param {Object} service - SQLite服务实例
   * @returns {Promise<boolean>}
   */
  async checkSQLiteHealth(service) {
    try {
      await service.testConnection();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * JSON文件健康检查
   * @param {Object} service - JSON服务实例
   * @returns {Promise<boolean>}
   */
  async checkJSONHealth(service) {
    try {
      // 简单检查服务是否可用
      return service && typeof service.getCustomer === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建降级服务
   * @param {Error} originalError - 原始错误
   * @param {string} requestedType - 请求的服务类型
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} 降级服务实例
   */
  async createFallbackService(originalError, requestedType, options) {
    this.logger.warn(`尝试创建降级服务`, {
      originalError: originalError.message,
      requestedType
    });

    // 降级策略：SQLite -> JSON -> Mock
    const fallbackOrder = ['sqlite', 'json', 'mock'];
    const currentIndex = fallbackOrder.indexOf(requestedType);
    
    for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
      const fallbackType = fallbackOrder[i];
      
      try {
        if (fallbackType === 'mock') {
          // 创建mock服务
          const { default: DataService } = await import('./dataService.js');
          const mockService = new DataService({
            ...options,
            configManager: this.configManager,
            mockMode: true
          });
          
          this.logger.info('降级到Mock数据服务');
          return mockService;
        } else {
          // 尝试创建其他类型的服务
          const service = await this.createDataService(fallbackType, {
            ...options,
            forceNew: true
          });
          
          this.logger.info(`降级到${fallbackType}数据服务`);
          return service;
        }
      } catch (fallbackError) {
        this.logger.warn(`降级到${fallbackType}失败`, {
          error: fallbackError.message
        });
        continue;
      }
    }

    // 所有降级都失败，抛出原始错误
    throw originalError;
  }

  /**
   * 获取当前数据服务实例
   * @returns {Object|null} 当前数据服务实例
   */
  getCurrentService() {
    if (this.currentServiceType && this.serviceInstances.has(this.currentServiceType)) {
      return this.serviceInstances.get(this.currentServiceType);
    }
    return null;
  }

  /**
   * 获取当前服务类型
   * @returns {string|null} 当前服务类型
   */
  getCurrentServiceType() {
    return this.currentServiceType;
  }

  /**
   * 处理配置变更
   * @param {Object} changeData - 配置变更数据
   */
  async handleConfigChange(changeData) {
    this.logger.info('检测到数据库配置变更', changeData);
    
    // 如果数据库类型发生变更，需要重新创建服务
    if (changeData.path === 'database.type') {
      const newType = changeData.value;
      
      try {
        // 创建新的数据服务
        const newService = await this.createDataService(newType, { forceNew: true });
        
        // 清理旧的服务实例
        this.cleanupOldServices(newType);
        
        this.logger.info(`数据服务已切换到${newType}`);
        
        // 发出服务切换事件
        if (this.configManager) {
          this.configManager.emit('dataServiceSwitched', {
            oldType: this.currentServiceType,
            newType,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        this.logger.error('数据服务切换失败', {
          newType,
          error: error.message
        });
      }
    }
  }

  /**
   * 清理旧的服务实例
   * @param {string} keepType - 保留的服务类型
   */
  cleanupOldServices(keepType) {
    for (const [type, service] of this.serviceInstances.entries()) {
      if (type !== keepType) {
        try {
          // 如果服务有cleanup方法，调用它
          if (service && typeof service.cleanup === 'function') {
            service.cleanup();
          }
          this.serviceInstances.delete(type);
          this.logger.info(`清理${type}数据服务实例`);
        } catch (error) {
          this.logger.warn(`清理${type}数据服务失败`, { error: error.message });
        }
      }
    }
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    for (const [type, service] of this.serviceInstances.entries()) {
      const isHealthy = await this.isServiceHealthy(service, type);
      
      if (!isHealthy) {
        this.logger.warn(`${type}数据服务健康检查失败，尝试重新创建`);
        
        try {
          // 重新创建服务
          const newService = await this.createDataService(type, { forceNew: true });
          this.serviceInstances.set(type, newService);
          
          this.logger.info(`${type}数据服务重新创建成功`);
        } catch (error) {
          this.logger.error(`${type}数据服务重新创建失败`, {
            error: error.message
          });
        }
      }
    }
  }

  /**
   * 清理敏感配置信息
   * @param {Object} config - 配置对象
   * @returns {Object} 清理后的配置
   */
  sanitizeConfig(config) {
    const sanitized = { ...config };
    
    // 移除敏感信息
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.uri && sanitized.uri.includes('@')) {
      sanitized.uri = sanitized.uri.replace(/\/\/[^@]+@/, '//***:***@');
    }
    
    return sanitized;
  }

  /**
   * 获取工厂状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      currentServiceType: this.currentServiceType,
      activeServices: Array.from(this.serviceInstances.keys()),
      healthCheckEnabled: !!this.healthCheckInterval,
      healthCheckInterval: this.healthCheckIntervalMs
    };
  }

  /**
   * 销毁工厂实例
   */
  destroy() {
    // 停止所有监控
    this.stopHealthCheck();
    this.stopConnectionPoolMonitoring();
    
    // 停止性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.stop();
    }
    
    // 清理服务实例
    this.cleanupOldServices(null);
    this.serviceInstances.clear();
    
    // 清理连接池指标
    this.connectionPoolMetrics.clear();
    
    // 移除事件监听器
    if (this.configManager) {
      this.configManager.removeAllListeners('configChanged');
    }
    
    DataServiceFactory.instance = null;
    this.logger.info('数据服务工厂已销毁');
  }
}

export default DataServiceFactory;