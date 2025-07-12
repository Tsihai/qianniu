/**
 * SQLite数据库配置与连接管理
 * 提供SQLite数据库连接服务
 */
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { getLogger } from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite3Verbose = sqlite3.verbose();

/**
 * SQLite数据库连接配置
 */
const config = {
  // 数据库文件路径，优先使用环境变量，否则使用默认路径
  dbPath: process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/qianniu.db'),
  
  // SQLite连接选项
  options: {
    mode: sqlite3Verbose.OPEN_READWRITE | sqlite3Verbose.OPEN_CREATE,
    verbose: process.env.NODE_ENV === 'development'
  },
  
  // 连接池配置
  pool: {
    max: 10,
    min: 1,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  
  // 性能优化配置
  performance: {
    busyTimeout: 30000,
    cacheSize: 2000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    tempStore: 'MEMORY'
  }
};

/**
 * SQLite连接管理器
 */
class SQLiteConnectionManager {
  constructor() {
    this.db = null;
    this.isConnected = false;
    this.isMockMode = false;
    this.logger = getLogger('SQLiteConnection');
    this.errorHandler = new ErrorHandler();
  }

  /**
   * 连接到SQLite数据库
   * @returns {Promise<boolean>} 连接是否成功
   */
  async connect() {
    if (this.isMockMode) {
      this.logger.info('SQLite Mock模式已启用，跳过实际数据库连接');
      this.isConnected = true;
      return true;
    }

    try {
      // 确保数据目录存在
      const dbDir = path.dirname(config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 创建数据库连接
      this.db = new sqlite3Verbose.Database(config.dbPath, config.options.mode, (err) => {
        if (err) {
          this.logger.error('SQLite数据库连接失败', {
            error: err.message,
            dbPath: config.dbPath
          });
          throw err;
        }
      });

      // 配置性能优化选项
      await this._configureDatabase();

      this.isConnected = true;
      this.logger.info('SQLite数据库连接成功', {
        dbPath: config.dbPath,
        mode: 'SQLite'
      });

      return true;
    } catch (error) {
      this.logger.error('SQLite数据库连接失败', {
        error: error.message,
        dbPath: config.dbPath
      });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'SQLiteConnection.connect' });
      }
      
      return false;
    }
  }

  /**
   * 配置数据库性能选项
   * @private
   */
  async _configureDatabase() {
    const pragmas = [
      `PRAGMA busy_timeout = ${config.performance.busyTimeout}`,
      `PRAGMA cache_size = ${config.performance.cacheSize}`,
      `PRAGMA journal_mode = ${config.performance.journalMode}`,
      `PRAGMA synchronous = ${config.performance.synchronous}`,
      `PRAGMA temp_store = ${config.performance.tempStore}`
    ];

    for (const pragma of pragmas) {
      await this._runQuery(pragma);
    }
  }

  /**
   * 执行SQL查询
   * @private
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise}
   */
  _runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * 断开数据库连接
   * @returns {Promise<boolean>} 断开是否成功
   */
  async disconnect() {
    if (this.isMockMode) {
      this.logger.info('SQLite Mock模式，跳过数据库断开');
      this.isConnected = false;
      return true;
    }

    try {
      if (this.db) {
        await new Promise((resolve, reject) => {
          this.db.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        this.db = null;
      }
      
      this.isConnected = false;
      this.logger.info('SQLite数据库连接已断开');
      return true;
    } catch (error) {
      this.logger.error('SQLite数据库断开失败', { error: error.message });
      
      if (this.errorHandler) {
        this.errorHandler.handle(error, { context: 'SQLiteConnection.disconnect' });
      }
      
      return false;
    }
  }

  /**
   * 检查连接状态
   * @returns {boolean} 是否已连接
   */
  isConnectedToDatabase() {
    return this.isConnected;
  }

  /**
   * 获取数据库实例
   * @returns {sqlite3.Database|null} 数据库实例
   */
  getDatabase() {
    return this.db;
  }

  /**
   * 启用Mock模式
   */
  enableMockMode() {
    this.isMockMode = true;
    this.logger.info('SQLite Mock模式已启用');
  }

  /**
   * 禁用Mock模式
   */
  disableMockMode() {
    this.isMockMode = false;
    this.logger.info('SQLite Mock模式已禁用');
  }

  /**
   * 检查是否为Mock模式
   * @returns {boolean} 是否为Mock模式
   */
  isMock() {
    return this.isMockMode;
  }

  /**
   * 测试数据库连接
   * @returns {Promise<boolean>} 连接测试是否成功
   */
  async testConnection() {
    if (this.isMockMode) {
      return true;
    }

    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // 执行简单查询测试连接
      await this._runQuery('SELECT 1');
      
      this.logger.info('SQLite数据库连接测试成功');
      return true;
    } catch (error) {
      this.logger.error('SQLite数据库连接测试失败', { error: error.message });
      return false;
    }
  }
}

// 创建单例实例
const sqliteConnection = new SQLiteConnectionManager();

// 导出配置和连接管理器
export {
  config,
  SQLiteConnectionManager
};

export default {
  config,
  connect: () => sqliteConnection.connect(),
  disconnect: () => sqliteConnection.disconnect(),
  isConnected: () => sqliteConnection.isConnectedToDatabase(),
  getDatabase: () => sqliteConnection.getDatabase(),
  enableMockMode: () => sqliteConnection.enableMockMode(),
  disableMockMode: () => sqliteConnection.disableMockMode(),
  isMock: () => sqliteConnection.isMock(),
  testConnection: () => sqliteConnection.testConnection(),
  SQLiteConnectionManager
};