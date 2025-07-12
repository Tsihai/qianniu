import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ErrorHandler, ERROR_CODES } from '../utils/ErrorHandler.js';
import { Logger } from '../utils/Logger.js';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 智能配置缓存类
 * 提供缓存统计、压缩、智能失效等功能
 */
class SmartConfigCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      compressionRatio: 0,
      memoryUsage: 0
    };
    this.compressionEnabled = true;
    this.maxSize = 1000; // 最大缓存条目数
    this.preloadKeys = new Set(); // 预加载键集合
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {any} 缓存值或null
   */
  get(key) {
    if (this.cache.has(key)) {
      this.stats.hits++;
      const entry = this.cache.get(key);
      return this._decompress(entry);
    }
    this.stats.misses++;
    return null;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   */
  set(key, value) {
    // 检查缓存大小限制
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }

    const compressed = this._compress(value);
    this.cache.set(key, {
      data: compressed.data,
      compressed: compressed.compressed,
      timestamp: Date.now(),
      accessCount: 0
    });
    
    this._updateMemoryUsage();
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this._updateMemoryUsage();
    }
    return deleted;
  }

  /**
   * 智能缓存失效 - 基于配置路径
   * @param {string} configPath - 配置路径
   */
  invalidateByPath(configPath) {
    const keysToDelete = this._findRelatedKeys(configPath);
    let deletedCount = 0;
    
    keysToDelete.forEach(key => {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    });
    
    this.stats.invalidations += deletedCount;
    this._updateMemoryUsage();
    
    return deletedCount;
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear();
    this.stats.invalidations += this.cache.size;
    this._updateMemoryUsage();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * 添加预加载键
   * @param {string} key - 预加载键
   */
  addPreloadKey(key) {
    this.preloadKeys.add(key);
  }

  /**
   * 获取预加载键列表
   * @returns {Array} 预加载键数组
   */
  getPreloadKeys() {
    return Array.from(this.preloadKeys);
  }

  /**
   * 压缩数据
   * @private
   * @param {any} value - 要压缩的值
   * @returns {Object} 压缩结果
   */
  _compress(value) {
    if (!this.compressionEnabled) {
      return { data: value, compressed: false };
    }

    try {
      const jsonString = JSON.stringify(value);
      if (jsonString.length < 100) {
        // 小数据不压缩
        return { data: value, compressed: false };
      }

      const compressed = zlib.gzipSync(jsonString);
      const compressionRatio = compressed.length / jsonString.length;
      
      // 如果压缩效果不好，不使用压缩
      if (compressionRatio > 0.8) {
        return { data: value, compressed: false };
      }

      return { data: compressed, compressed: true };
    } catch (error) {
      return { data: value, compressed: false };
    }
  }

  /**
   * 解压缩数据
   * @private
   * @param {Object} entry - 缓存条目
   * @returns {any} 解压缩后的值
   */
  _decompress(entry) {
    entry.accessCount++;
    entry.lastAccess = Date.now();

    if (!entry.compressed) {
      return entry.data;
    }

    try {
      const decompressed = zlib.gunzipSync(entry.data);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.warn('缓存解压缩失败:', error.message);
      return null;
    }
  }

  /**
   * 查找相关键
   * @private
   * @param {string} configPath - 配置路径
   * @returns {Array} 相关键数组
   */
  _findRelatedKeys(configPath) {
    const relatedKeys = [];
    const pathPrefix = `get:${configPath}`;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(pathPrefix) || 
          key.startsWith(`get:${configPath}.`) ||
          configPath.startsWith(key.replace('get:', '').split(':')[0])) {
        relatedKeys.push(key);
      }
    }
    
    return relatedKeys;
  }

  /**
   * LRU淘汰策略
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const lastAccess = entry.lastAccess || entry.timestamp;
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 更新内存使用统计
   * @private
   */
  _updateMemoryUsage() {
    let totalSize = 0;
    let compressedSize = 0;
    let uncompressedSize = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.compressed) {
        compressedSize += entry.data.length;
      } else {
        const size = JSON.stringify(entry.data).length;
        uncompressedSize += size;
      }
    }
    
    totalSize = compressedSize + uncompressedSize;
    this.stats.memoryUsage = totalSize;
    this.stats.compressionRatio = uncompressedSize > 0 
      ? ((uncompressedSize - compressedSize) / uncompressedSize * 100).toFixed(2)
      : 0;
  }
}

/**
 * 配置管理器 - 单例模式
 * 提供统一的配置管理功能，支持分层配置、环境变量覆盖、配置验证等
 */
class ConfigManager extends EventEmitter {
  constructor() {
    super();
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    
    this.config = {};
    this.schema = null;
    this.configCache = new SmartConfigCache(); // 智能配置缓存
    this.watchers = new Map();
    this.isInitialized = false;
    this.configDir = path.join(__dirname);
    
    // 初始化AJV验证器
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.validator = null;
    
    // 初始化审计日志器
    this.auditLogger = null;
    this._initializeAuditLogger();
    
    // 初始化缓存事件监听
    this._initializeCacheEvents();
    
    ConfigManager.instance = this;
  }

  /**
   * 初始化审计日志器
   * @private
   */
  _initializeAuditLogger() {
    try {
      // 创建审计日志器实例
      this.auditLogger = new Logger({
        module: 'config-audit',
        level: 'info',
        console: false, // 禁用控制台输出
        enableFile: true,
        filePath: path.join(process.cwd(), 'logs', 'config-audit.log'),
        file: {
          format: 'json',
          rotation: {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
          }
        }
      });
    } catch (error) {
      console.warn('审计日志器初始化失败:', error.message);
      this.auditLogger = null;
    }
  }

  /**
   * 初始化缓存事件监听
   * @private
   */
  _initializeCacheEvents() {
    // 监听配置变更事件，自动失效相关缓存
    this.on('configChanged', (data) => {
      if (data && data.path) {
        const invalidatedCount = this.configCache.invalidateByPath(data.path);
        if (invalidatedCount > 0) {
          this.emit('cacheInvalidated', {
            path: data.path,
            invalidatedCount,
            timestamp: Date.now()
          });
        }
      }
    });

    // 监听配置重载事件，清除所有缓存
    this.on('configReloaded', () => {
      this.configCache.clear();
      this.emit('cacheCleared', {
        reason: 'configReloaded',
        timestamp: Date.now()
      });
    });
  }

  /**
   * 记录审计日志
   * @private
   * @param {string} operation - 操作类型
   * @param {string} path - 配置路径
   * @param {Object} details - 详细信息
   */
  _logAudit(operation, path, details = {}) {
    if (!this.auditLogger || !this._isAuditEnabled()) {
      return;
    }

    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      configPath: path,
      environment: this.env || 'unknown',
      processId: process.pid,
      ...details
    };

    try {
      this.auditLogger.info('Config audit log', auditEntry);
    } catch (error) {
      console.warn('审计日志记录失败:', error.message);
    }
  }

  /**
   * 检查审计日志是否启用
   * @private
   * @returns {boolean}
   */
  _isAuditEnabled() {
    if (!this.config || !this.config.audit) {
      return false;
    }
    return this.config.audit.enabled === true;
  }

  /**
   * 检查特定操作的审计日志是否启用
   * @private
   * @param {string} operation - 操作类型
   * @returns {boolean}
   */
  _isOperationAuditEnabled(operation) {
    if (!this._isAuditEnabled()) {
      return false;
    }
    
    const operations = this.config.audit.operations || {};
    switch (operation) {
      case 'read':
        return operations.logRead === true;
      case 'write':
        return operations.logWrite === true;
      case 'validation':
        return operations.logValidation === true;
      case 'reload':
        return operations.logReload === true;
      default:
        return true;
    }
  }

  /**
   * 获取ConfigManager单例实例
   * @returns {ConfigManager}
   */
  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 获取数据库配置
   * 支持MongoDB、SQLite、JSON文件三种存储方式
   * @returns {Object} 数据库配置对象
   */
  getDatabaseConfig() {
    const dbType = this.get('database.type', 'mongodb');
    const config = {
      type: dbType,
      mockMode: this.get('database.mockMode', false)
    };

    switch (dbType.toLowerCase()) {
      case 'mongodb':
        config.mongodb = {
          uri: this.get('database.mongodb.uri', 'mongodb://localhost:27017/qianniu'),
          options: this.get('database.mongodb.options', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
          })
        };
        break;

      case 'sqlite':
        config.sqlite = {
          dbPath: this.get('database.sqlite.dbPath', './data/qianniu.db'),
          options: this.get('database.sqlite.options', {
            busyTimeout: 30000,
            cacheSize: 2000,
            journalMode: 'WAL',
            synchronous: 'NORMAL'
          })
        };
        break;

      case 'json':
      case 'file':
        config.json = {
          dataDir: this.get('database.json.dataDir', './data'),
          autoSave: this.get('database.json.autoSave', true),
          saveInterval: this.get('database.json.saveInterval', 5000)
        };
        break;

      default:
        throw ErrorHandler.createError(
          ERROR_CODES.CONFIG.INVALID_VALUE,
          `不支持的数据库类型: ${dbType}`,
          { supportedTypes: ['mongodb', 'sqlite', 'json'] }
        );
    }

    return config;
  }

  /**
   * 设置数据库类型
   * @param {string} type - 数据库类型 (mongodb|sqlite|json)
   */
  setDatabaseType(type) {
    const supportedTypes = ['mongodb', 'sqlite', 'json', 'file'];
    const normalizedType = type.toLowerCase();
    
    if (!supportedTypes.includes(normalizedType)) {
      throw ErrorHandler.createError(
        ERROR_CODES.CONFIG.INVALID_VALUE,
        `不支持的数据库类型: ${type}`,
        { supportedTypes }
      );
    }
    
    const oldType = this.getDatabaseType();
    this.set('database.type', normalizedType);
    
    // 发出配置变更事件
    this.emit('configChanged', {
      path: 'database.type',
      oldValue: oldType,
      value: normalizedType,
      timestamp: Date.now()
    });
    
    // 记录审计日志
    if (this._isOperationAuditEnabled('write')) {
      this._logAudit('write', 'database.type', {
        oldValue: oldType,
        newValue: normalizedType,
        action: 'database_type_changed'
      });
    }
  }

  /**
   * 启用/禁用Mock模式
   * @param {boolean} enabled - 是否启用Mock模式
   */
  setMockMode(enabled) {
    this.set('database.mockMode', Boolean(enabled));
  }

  /**
   * 获取当前数据库类型
   * @returns {string} 数据库类型
   */
  getDatabaseType() {
    return this.get('database.type', 'mongodb');
  }

  /**
   * 检查是否为Mock模式
   * @returns {boolean} 是否为Mock模式
   */
  isMockMode() {
    return this.get('database.mockMode', false);
  }

  /**
   * 初始化配置管理器
   * @param {Object} options - 初始化选项
   * @param {string} options.env - 环境名称 (development, production, test)
   * @param {string} options.configDir - 配置文件目录
   * @param {boolean} options.enableWatcher - 是否启用文件监听
   */
  async initialize(options = {}) {
    const initStartTime = Date.now();
    
    try {
      const {
        env = process.env.NODE_ENV || 'development',
        configDir = this.configDir,
        enableWatcher = false
      } = options;

      this.env = env;
      this.configDir = configDir;
      this.enableWatcher = enableWatcher;

      // 加载配置文件
      await this.loadConfigurations();
      
      // 重新初始化审计日志器（现在配置已加载）
      this._initializeAuditLogger();
      
      // 记录初始化开始审计日志
      if (this._isAuditEnabled()) {
        this._logAudit('initialize', 'configuration', {
          action: 'start',
          environment: env,
          configDir: configDir,
          enableWatcher: enableWatcher
        });
      }
      
      // 应用环境变量覆盖
      this.applyEnvironmentOverrides();
      
      // 验证配置
      await this.validateConfiguration();
      
      // 启用文件监听（如果需要）
      if (enableWatcher) {
        this.setupFileWatchers();
      }
      
      this.isInitialized = true;
      
      // 记录初始化成功审计日志
      if (this._isAuditEnabled()) {
        this._logAudit('initialize', 'configuration', {
          action: 'success',
          duration: Date.now() - initStartTime,
          watchersEnabled: enableWatcher
        });
      }
      
      this.emit('initialized', this.config);
      
      return this;
    } catch (error) {
      // 记录初始化失败审计日志
      if (this.auditLogger) {
        this._logAudit('initialize', 'configuration', {
          action: 'failed',
          error: error.message,
          duration: Date.now() - initStartTime
        });
      }
      
      throw ErrorHandler.createError(
        ERROR_CODES.CONFIG.INITIALIZATION_FAILED,
        { 
          reason: error.message,
          originalError: error 
        }
      );
    }
  }

  /**
   * 加载配置文件
   * 按优先级加载: default.json -> {env}.json -> local.json
   */
  async loadConfigurations() {
    const configFiles = [
      'default.json',
      `${this.env}.json`,
      'local.json'
    ];

    this.config = {};
    
    for (const fileName of configFiles) {
      const filePath = path.join(this.configDir, fileName);
      
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const configData = JSON.parse(fileContent);
          
          // 深度合并配置
          this.config = this.deepMerge(this.config, configData);
          
          console.log(`已加载配置文件: ${fileName}`);
        } catch (error) {
          throw ErrorHandler.createError(
            ERROR_CODES.CONFIG.INVALID_FORMAT,
            `配置文件格式错误: ${fileName}`,
            { filePath, originalError: error }
          );
        }
      }
    }

    // 加载schema文件
    const schemaPath = path.join(this.configDir, 'schema.json');
    if (fs.existsSync(schemaPath)) {
      try {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        this.schema = JSON.parse(schemaContent);
      } catch (error) {
        console.warn(`配置schema加载失败: ${error.message}`);
      }
    }
  }

  /**
   * 应用环境变量覆盖
   * 支持多种前缀和点号路径格式
   * 支持的前缀: APP_, CONFIG_, QIANNIU_
   * 格式示例: CONFIG_SERVER_PORT -> server.port
   */
  applyEnvironmentOverrides() {
    const envPrefixes = ['APP_', 'CONFIG_', 'QIANNIU_'];
    
    Object.keys(process.env).forEach(key => {
      for (const prefix of envPrefixes) {
        if (key.startsWith(prefix)) {
          const configPath = key
            .substring(prefix.length)
            .toLowerCase()
            .replace(/_/g, '.');
          
          const value = this.parseEnvValue(process.env[key]);
          this.set(configPath, value);
          
          console.log(`环境变量覆盖: ${key} -> ${configPath} = ${JSON.stringify(value)}`);
          break;
        }
      }
    });
  }

  /**
   * 解析环境变量值
   * 支持多种数据类型的自动转换
   * @param {string} value - 环境变量值
   * @returns {any} 解析后的值
   */
  parseEnvValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // 处理空值
    if (value === '' || value.toLowerCase() === 'null') {
      return null;
    }
    
    if (value.toLowerCase() === 'undefined') {
      return undefined;
    }
    
    // 尝试解析为JSON（对象或数组）
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn(`JSON解析失败: ${value}, 使用原始字符串`);
        return value;
      }
    }
    
    // 解析布尔值
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
      return true;
    }
    if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
      return false;
    }
    
    // 解析数字（整数和浮点数）
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // 解析逗号分隔的数组
    if (value.includes(',') && !value.includes(' ')) {
      return value.split(',').map(item => this.parseEnvValue(item.trim()));
    }
    
    return value;
  }

  /**
   * 获取配置值
   * @param {string} path - 配置路径，支持点号分隔
   * @param {any} defaultValue - 默认值
   * @returns {any} 配置值
   */
  get(path, defaultValue = undefined) {
    if (!this.isInitialized) {
      throw ErrorHandler.createError(
        ERROR_CODES.CONFIG.NOT_INITIALIZED,
        '配置管理器未初始化'
      );
    }

    // 检查缓存
    const cacheKey = `get:${path}:${typeof defaultValue === 'function' ? 'function' : JSON.stringify(defaultValue)}`;
    const cachedValue = this.configCache.get(cacheKey);
    if (cachedValue !== null) {
      // 记录读取审计日志
      if (this._isOperationAuditEnabled('read')) {
        this._logAudit('read', path, {
          value: cachedValue,
          source: 'cache',
          hasDefaultValue: defaultValue !== undefined
        });
      }
      
      return cachedValue;
    }

    const notFoundSymbol = Symbol('not-found');
    let value = this.getNestedValue(this.config, path, notFoundSymbol);
    
    // 如果未找到值，使用默认值处理逻辑
    if (value === notFoundSymbol) {
      value = this.resolveDefaultValue(path, defaultValue);
    }
    
    // 记录读取审计日志
    if (this._isOperationAuditEnabled('read')) {
      this._logAudit('read', path, {
        value: value,
        source: value === notFoundSymbol ? 'not_found' : 'config',
        hasDefaultValue: defaultValue !== undefined,
        usedDefaultValue: value === notFoundSymbol
      });
    }
    
    // 缓存结果（只缓存非undefined的值以避免缓存污染）
    if (value !== undefined) {
      this.configCache.set(cacheKey, value);
    }
    
    return value;
  }

  /**
   * 解析默认值
   * 支持函数类型的默认值和深层嵌套默认值
   * @param {string} path - 配置路径
   * @param {any} defaultValue - 默认值
   * @returns {any} 解析后的默认值
   */
  resolveDefaultValue(path, defaultValue) {
    // 如果默认值是函数，执行它
    if (typeof defaultValue === 'function') {
      try {
        return defaultValue(path, this.config);
      } catch (error) {
        console.warn(`默认值函数执行失败 (${path}):`, error.message);
        return undefined;
      }
    }
    
    // 如果没有提供默认值，尝试从schema中获取默认值
    if (defaultValue === undefined && this.schema) {
      const schemaDefault = this.getSchemaDefault(path);
      if (schemaDefault !== undefined) {
        return schemaDefault;
      }
    }
    
    return defaultValue;
  }

  /**
   * 从schema中获取默认值
   * @param {string} path - 配置路径
   * @returns {any} schema中定义的默认值
   */
  getSchemaDefault(path) {
    if (!this.schema || !this.schema.properties) {
      return undefined;
    }
    
    const keys = path.split('.');
    let current = this.schema.properties;
    
    for (const key of keys) {
      if (!current || !current[key]) {
        return undefined;
      }
      
      if (current[key].default !== undefined) {
        return current[key].default;
      }
      
      if (current[key].properties) {
        current = current[key].properties;
      } else {
        return undefined;
      }
    }
    
    return undefined;
  }

  /**
   * 设置配置值
   * @param {string} path - 配置路径
   * @param {any} value - 配置值
   */
  set(path, value) {
    // 获取旧值用于审计日志
    const notFoundSymbol = Symbol('not-found');
    const oldValue = this.getNestedValue(this.config, path, notFoundSymbol);
    
    this.setNestedValue(this.config, path, value);
    
    // 记录写入审计日志
    if (this._isOperationAuditEnabled('write')) {
      this._logAudit('write', path, {
        oldValue: oldValue === notFoundSymbol ? undefined : oldValue,
        newValue: value,
        isNewProperty: oldValue === notFoundSymbol
      });
    }
    
    // 清除相关缓存
    this.clearCacheByPath(path);
    
    this.emit('configChanged', { path, value });
  }

  /**
   * 检查配置是否存在
   * @param {string} path - 配置路径
   * @returns {boolean}
   */
  has(path) {
    const notFoundSymbol = Symbol('not-found');
    return this.getNestedValue(this.config, path, notFoundSymbol) !== notFoundSymbol;
  }

  /**
   * 获取嵌套对象的值
   * @param {Object} obj - 对象
   * @param {string} path - 路径
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  getNestedValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * 设置嵌套对象的值
   * @param {Object} obj - 对象
   * @param {string} path - 路径
   * @param {any} value - 值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  /**
   * 深度合并对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object} 合并后的对象
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 验证配置
   * 使用JSON Schema进行完整的配置验证
   */
  async validateConfiguration() {
    if (!this.schema) {
      console.log('未找到配置schema，跳过验证');
      return;
    }

    const validationStartTime = Date.now();
    let validationResult = null;
    let validationErrors = null;

    try {
      // 编译schema（如果还未编译）
      if (!this.validator) {
        this.validator = this.ajv.compile(this.schema);
      }
      
      // 执行验证
      const isValid = this.validator(this.config);
      validationResult = isValid;
      
      if (!isValid) {
        validationErrors = this.validator.errors;
        const errors = this.formatValidationErrors(this.validator.errors);
        
        // 记录验证失败审计日志
        if (this._isOperationAuditEnabled('validation')) {
          this._logAudit('validation', 'schema', {
            result: 'failed',
            errors: validationErrors,
            duration: Date.now() - validationStartTime
          });
        }
        
        throw ErrorHandler.createError(
          ERROR_CODES.CONFIG.VALIDATION_FAILED,
          { 
            field: errors,
            validationErrors: this.validator.errors,
            config: this.config 
          }
        );
      }
      
      // 记录验证成功审计日志
      if (this._isOperationAuditEnabled('validation')) {
        this._logAudit('validation', 'schema', {
          result: 'success',
          duration: Date.now() - validationStartTime
        });
      }
      
      console.log('配置验证通过');
    } catch (error) {
      if (error.code === ERROR_CODES.CONFIG.VALIDATION_FAILED) {
        throw error;
      }
      
      // 记录验证错误审计日志
      if (this._isOperationAuditEnabled('validation')) {
        this._logAudit('validation', 'schema', {
          result: 'error',
          error: error.message,
          duration: Date.now() - validationStartTime
        });
      }
      
      throw ErrorHandler.createError(
        ERROR_CODES.CONFIG.VALIDATION_FAILED,
        { 
          field: `配置验证过程中发生错误: ${error.message}`,
          originalError: error 
        }
      );
    }
  }

  /**
   * 格式化验证错误信息
   * @param {Array} errors - AJV验证错误数组
   * @returns {string} 格式化的错误信息
   */
  formatValidationErrors(errors) {
    if (!errors || errors.length === 0) {
      return '未知验证错误';
    }
    
    return errors.map(error => {
      const path = error.instancePath || error.dataPath || 'root';
      const message = error.message;
      const allowedValues = error.params?.allowedValues;
      
      let errorMsg = `路径 '${path}': ${message}`;
      
      if (allowedValues) {
        errorMsg += ` (允许的值: ${allowedValues.join(', ')})`;
      }
      
      if (error.data !== undefined) {
        errorMsg += ` (当前值: ${JSON.stringify(error.data)})`;
      }
      
      return errorMsg;
    }).join('; ');
  }

  /**
   * 设置文件监听器
   */
  setupFileWatchers() {
    const configFiles = [
      'default.json',
      `${this.env}.json`,
      'local.json',
      'schema.json'
    ];

    // 防抖配置
    this.debounceTimers = new Map();
    this.debounceDelay = 1000; // 1秒防抖延迟
    this.watcherStates = new Map();

    configFiles.forEach(fileName => {
      const filePath = path.join(this.configDir, fileName);
      
      if (fs.existsSync(filePath)) {
        try {
          const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
              this._handleFileChange(fileName, filePath);
            }
          });
          
          // 设置错误处理
          watcher.on('error', (error) => {
            console.error(`文件监听器错误 (${fileName}):`, error.message);
            this._logAudit('file_watcher_error', fileName, {
              error: error.message,
              filePath: filePath
            });
            
            // 尝试重新建立监听
            this._restartWatcher(fileName, filePath);
          });
          
          this.watchers.set(fileName, watcher);
          this.watcherStates.set(fileName, {
            active: true,
            lastChange: null,
            errorCount: 0
          });
          
          console.log(`文件监听器已启动: ${fileName}`);
        } catch (error) {
          console.error(`启动文件监听器失败 (${fileName}):`, error.message);
          this._logAudit('file_watcher_start_error', fileName, {
            error: error.message,
            filePath: filePath
          });
        }
      }
    });
  }

  /**
   * 处理文件变更（带防抖）
   * @private
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   */
  _handleFileChange(fileName, filePath) {
    // 清除之前的防抖定时器
    if (this.debounceTimers.has(fileName)) {
      clearTimeout(this.debounceTimers.get(fileName));
    }
    
    // 设置新的防抖定时器
    const timer = setTimeout(async () => {
      console.log(`配置文件已更改: ${fileName}`);
      
      // 更新监听器状态
      const state = this.watcherStates.get(fileName);
      if (state) {
        state.lastChange = new Date().toISOString();
      }
      
      await this.reloadConfiguration(fileName);
      this.debounceTimers.delete(fileName);
    }, this.debounceDelay);
    
    this.debounceTimers.set(fileName, timer);
  }

  /**
   * 重启文件监听器
   * @private
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   */
  _restartWatcher(fileName, filePath) {
    const state = this.watcherStates.get(fileName);
    if (!state) return;
    
    state.errorCount++;
    
    // 如果错误次数过多，停止重试
    if (state.errorCount > 3) {
      console.error(`文件监听器重试次数过多，停止监听: ${fileName}`);
      state.active = false;
      return;
    }
    
    // 延迟重启
    setTimeout(() => {
      try {
        // 关闭旧的监听器
        const oldWatcher = this.watchers.get(fileName);
        if (oldWatcher) {
          oldWatcher.close();
        }
        
        // 创建新的监听器
        if (fs.existsSync(filePath)) {
          const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
              this._handleFileChange(fileName, filePath);
            }
          });
          
          watcher.on('error', (error) => {
            console.error(`文件监听器错误 (${fileName}):`, error.message);
            this._restartWatcher(fileName, filePath);
          });
          
          this.watchers.set(fileName, watcher);
          state.active = true;
          console.log(`文件监听器已重启: ${fileName}`);
        }
      } catch (error) {
        console.error(`重启文件监听器失败 (${fileName}):`, error.message);
      }
    }, 2000 * state.errorCount); // 递增延迟
  }

  /**
   * 重新加载配置
   * @param {string} [triggerFile] - 触发重载的文件名
   */
  async reloadConfiguration(triggerFile = null) {
    const reloadStartTime = Date.now();
    
    try {
      // 记录重新加载开始审计日志
      if (this._isOperationAuditEnabled('reload')) {
        this._logAudit('reload', 'configuration', {
          action: 'start',
          trigger: 'file_change',
          triggerFile: triggerFile
        });
      }
      
      // 保存当前配置用于回滚
      const previousConfig = JSON.parse(JSON.stringify(this.config));
      
      // 清除缓存
      this.configCache.clear();
      
      // 重新加载配置
      await this.loadConfigurations();
      this.applyEnvironmentOverrides();
      await this.validateConfiguration();
      
      // 检测配置差异
      const configDiff = this._detectConfigChanges(previousConfig, this.config);
      
      // 记录重新加载成功审计日志
      if (this._isOperationAuditEnabled('reload')) {
        this._logAudit('reload', 'configuration', {
          action: 'success',
          duration: Date.now() - reloadStartTime,
          triggerFile: triggerFile,
          changes: configDiff
        });
      }
      
      this.emit('configReloaded', {
        config: this.config,
        changes: configDiff,
        triggerFile: triggerFile
      });
      
      console.log('配置已重新加载', configDiff.length > 0 ? `(${configDiff.length}个变更)` : '');
    } catch (error) {
      // 记录重新加载失败审计日志
      if (this._isOperationAuditEnabled('reload')) {
        this._logAudit('reload', 'configuration', {
          action: 'failed',
          error: error.message,
          duration: Date.now() - reloadStartTime,
          triggerFile: triggerFile
        });
      }
      
      console.error('配置重新加载失败:', error.message);
      this.emit('configReloadError', {
        error: error,
        triggerFile: triggerFile
      });
      
      // 这里可以实现回滚逻辑，但需要谨慎处理
      // 因为回滚可能也会失败
    }
  }

  /**
   * 清除路径相关的缓存
   * @param {string} path - 配置路径
   */
  clearCacheByPath(path) {
    return this.configCache.invalidateByPath(path);
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    return this.configCache.getStats();
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.configCache.clear();
    this.emit('cacheCleared', {
      reason: 'manual',
      timestamp: Date.now()
    });
  }

  /**
   * 添加预加载配置键
   * @param {string} key - 配置键
   */
  addPreloadKey(key) {
    this.configCache.addPreloadKey(key);
  }

  /**
   * 预加载配置
   * 预先加载常用配置到缓存中
   */
  preloadConfigurations() {
    const preloadKeys = this.configCache.getPreloadKeys();
    let loadedCount = 0;
    
    preloadKeys.forEach(key => {
      try {
        this.get(key); // 触发缓存加载
        loadedCount++;
      } catch (error) {
        console.warn(`预加载配置失败 (${key}):`, error.message);
      }
    });
    
    console.log(`预加载完成: ${loadedCount}/${preloadKeys.length} 个配置项`);
    
    this.emit('preloadCompleted', {
      totalKeys: preloadKeys.length,
      loadedCount,
      timestamp: Date.now()
    });
    
    return loadedCount;
  }

  /**
   * 获取所有配置
   * @returns {Object} 完整配置对象
   */
  getAll() {
    if (!this.isInitialized) {
      throw ErrorHandler.createError(
        ERROR_CODES.CONFIG.NOT_INITIALIZED,
        '配置管理器未初始化'
      );
    }
    
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 检测配置变更差异
   * @private
   * @param {Object} oldConfig - 旧配置
   * @param {Object} newConfig - 新配置
   * @returns {Array} 变更列表
   */
  _detectConfigChanges(oldConfig, newConfig) {
    const changes = [];
    
    const compareObjects = (old, current, path = '') => {
      const oldKeys = Object.keys(old || {});
      const currentKeys = Object.keys(current || {});
      const allKeys = new Set([...oldKeys, ...currentKeys]);
      
      for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const oldValue = old?.[key];
        const currentValue = current?.[key];
        
        if (oldValue === undefined && currentValue !== undefined) {
          changes.push({
            type: 'added',
            path: currentPath,
            value: currentValue
          });
        } else if (oldValue !== undefined && currentValue === undefined) {
          changes.push({
            type: 'removed',
            path: currentPath,
            oldValue: oldValue
          });
        } else if (typeof oldValue === 'object' && typeof currentValue === 'object' && 
                   oldValue !== null && currentValue !== null) {
          compareObjects(oldValue, currentValue, currentPath);
        } else if (oldValue !== currentValue) {
          changes.push({
            type: 'modified',
            path: currentPath,
            oldValue: oldValue,
            newValue: currentValue
          });
        }
      }
    };
    
    compareObjects(oldConfig, newConfig);
    return changes;
  }

  /**
   * 获取文件监听器状态
   * @returns {Object} 监听器状态信息
   */
  getWatcherStatus() {
    const status = {
      enabled: this.enableWatcher,
      watchers: {},
      totalWatchers: this.watchers.size,
      activeWatchers: 0
    };
    
    for (const [fileName, state] of this.watcherStates) {
      status.watchers[fileName] = {
        active: state.active,
        lastChange: state.lastChange,
        errorCount: state.errorCount,
        hasWatcher: this.watchers.has(fileName)
      };
      
      if (state.active) {
        status.activeWatchers++;
      }
    }
    
    return status;
  }

  /**
   * 配置缓存设置
   * @param {Object} options - 缓存配置选项
   * @param {number} options.maxSize - 最大缓存条目数
   * @param {boolean} options.compressionEnabled - 是否启用压缩
   */
  configureCaching(options = {}) {
    if (options.maxSize !== undefined) {
      this.configCache.maxSize = options.maxSize;
    }
    if (options.compressionEnabled !== undefined) {
      this.configCache.compressionEnabled = options.compressionEnabled;
    }
    
    this.emit('cacheConfigured', {
      maxSize: this.configCache.maxSize,
      compressionEnabled: this.configCache.compressionEnabled,
      timestamp: Date.now()
    });
  }

  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用统计
   */
  getMemoryUsage() {
    const cacheStats = this.configCache.getStats();
    const configSize = JSON.stringify(this.config).length;
    const schemaSize = this.schema ? JSON.stringify(this.schema).length : 0;
    
    return {
      cache: {
        memoryUsage: cacheStats.memoryUsage,
        cacheSize: cacheStats.cacheSize,
        compressionRatio: cacheStats.compressionRatio
      },
      config: {
        size: configSize,
        itemCount: Object.keys(this.config).length
      },
      schema: {
        size: schemaSize
      },
      total: cacheStats.memoryUsage + configSize + schemaSize
    };
  }

  /**
   * 优化内存使用
   * 清理不常用的缓存项
   */
  optimizeMemory() {
    const beforeStats = this.configCache.getStats();
    
    // 触发LRU清理（通过设置一个临时的较小maxSize）
    const originalMaxSize = this.configCache.maxSize;
    this.configCache.maxSize = Math.floor(originalMaxSize * 0.7); // 保留70%
    
    // 添加一个临时项触发清理
    this.configCache.set('__temp_cleanup__', {});
    this.configCache.delete('__temp_cleanup__');
    
    // 恢复原始大小
    this.configCache.maxSize = originalMaxSize;
    
    const afterStats = this.configCache.getStats();
    const freedMemory = beforeStats.memoryUsage - afterStats.memoryUsage;
    
    this.emit('memoryOptimized', {
      beforeSize: beforeStats.cacheSize,
      afterSize: afterStats.cacheSize,
      freedMemory,
      timestamp: Date.now()
    });
    
    return {
      freedItems: beforeStats.cacheSize - afterStats.cacheSize,
      freedMemory
    };
  }

  /**
   * 销毁配置管理器
   */
  destroy() {
    // 清除防抖定时器
    if (this.debounceTimers) {
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
    }
    
    // 关闭文件监听器
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (error) {
        console.warn('关闭文件监听器时出错:', error.message);
      }
    });
    this.watchers.clear();
    
    // 清除监听器状态
    if (this.watcherStates) {
      this.watcherStates.clear();
    }
    
    // 清除缓存
    this.configCache.clear();
    
    // 移除所有监听器
    this.removeAllListeners();
    
    this.isInitialized = false;
    
    console.log('配置管理器已销毁');
  }
}

// 确保单例
ConfigManager.instance = null;

export {
  ConfigManager,
  SmartConfigCache
};

export default ConfigManager;