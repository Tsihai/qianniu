/**
 * SQLite数据库连接管理器
 * 提供连接池管理、事务支持、错误处理和性能优化
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { getLogger } from '../utils/Logger.js';

const sqlite3Verbose = sqlite3.verbose();

// SQLite相关错误码
const SQLITE_ERROR_CODES = {
  CONNECTION_FAILED: 'SQLITE_CONNECTION_FAILED',
  TRANSACTION_FAILED: 'SQLITE_TRANSACTION_FAILED',
  QUERY_FAILED: 'SQLITE_QUERY_FAILED',
  DATABASE_LOCKED: 'SQLITE_DATABASE_LOCKED',
  DISK_FULL: 'SQLITE_DISK_FULL',
  PERMISSION_DENIED: 'SQLITE_PERMISSION_DENIED',
  CORRUPTION: 'SQLITE_CORRUPTION',
  INITIALIZATION_FAILED: 'SQLITE_INITIALIZATION_FAILED',
  POOL_EXHAUSTED: 'SQLITE_POOL_EXHAUSTED',
  BACKUP_FAILED: 'SQLITE_BACKUP_FAILED'
};

/**
 * SQLite连接池管理器
 */
class SQLiteConnectionPool {
  constructor(options = {}) {
    this.dbPath = options.dbPath;
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    this.acquireTimeout = options.acquireTimeout || 30000; // 30秒
    this.idleTimeout = options.idleTimeout || 300000; // 5分钟
    
    this.connections = [];
    this.availableConnections = [];
    this.pendingRequests = [];
    this.activeConnections = new Set();
    
    this.logger = getLogger('SQLiteConnectionPool');
    this.isInitialized = false;
    this.isDestroyed = false;
  }
  
  /**
   * 初始化连接池
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      this.logger.info('Initializing SQLite connection pool', {
        dbPath: this.dbPath,
        maxConnections: this.maxConnections,
        minConnections: this.minConnections
      });
      
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // 创建最小连接数
      for (let i = 0; i < this.minConnections; i++) {
        const connection = await this.createConnection();
        this.connections.push(connection);
        this.availableConnections.push(connection);
      }
      
      // 设置空闲连接清理定时器
      this.setupIdleConnectionCleanup();
      
      this.isInitialized = true;
      this.logger.info('SQLite connection pool initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize SQLite connection pool', { error: error.message }, error);
      throw ErrorHandler.wrapError(error, SQLITE_ERROR_CODES.INITIALIZATION_FAILED, {
        dbPath: this.dbPath
      });
    }
  }
  
  /**
   * 创建新的数据库连接
   */
  async createConnection() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3Verbose.Database(this.dbPath, sqlite3Verbose.OPEN_READWRITE | sqlite3Verbose.OPEN_CREATE, (err) => {
        if (err) {
          this.logger.error('Failed to create SQLite connection', { error: err.message }, err);
          reject(ErrorHandler.wrapError(err, SQLITE_ERROR_CODES.CONNECTION_FAILED, {
            dbPath: this.dbPath
          }));
          return;
        }
        
        // 配置连接参数
        this.configureConnection(db);
        
        // 添加连接元数据
        db._connectionId = this.generateConnectionId();
        db._createdAt = Date.now();
        db._lastUsed = Date.now();
        db._isInTransaction = false;
        
        this.logger.debug('SQLite connection created', {
          connectionId: db._connectionId,
          dbPath: this.dbPath
        });
        
        resolve(db);
      });
      
      // 设置错误处理
      db.on('error', (err) => {
        this.logger.error('SQLite connection error', {
          connectionId: db._connectionId,
          error: err.message
        }, err);
      });
    });
  }
  
  /**
   * 配置数据库连接参数
   */
  configureConnection(db) {
    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');
    
    // 设置WAL模式以提高并发性能
    db.run('PRAGMA journal_mode = WAL');
    
    // 设置同步模式
    db.run('PRAGMA synchronous = NORMAL');
    
    // 设置缓存大小（2MB）
    db.run('PRAGMA cache_size = -2000');
    
    // 设置临时存储为内存
    db.run('PRAGMA temp_store = MEMORY');
    
    // 设置mmap大小（256MB）
    db.run('PRAGMA mmap_size = 268435456');
    
    // 设置忙等待超时（30秒）
    db.run('PRAGMA busy_timeout = 30000');
  }
  
  /**
   * 生成连接ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取连接
   */
  async acquire() {
    if (this.isDestroyed) {
      throw ErrorHandler.createError(SQLITE_ERROR_CODES.CONNECTION_FAILED, {
        reason: 'Connection pool has been destroyed'
      });
    }
    
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(ErrorHandler.createError(SQLITE_ERROR_CODES.POOL_EXHAUSTED, {
          timeout: this.acquireTimeout,
          activeConnections: this.activeConnections.size,
          maxConnections: this.maxConnections
        }));
      }, this.acquireTimeout);
      
      this.pendingRequests.push({
        resolve: (connection) => {
          clearTimeout(timeoutId);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      this.processNextRequest();
    });
  }
  
  /**
   * 处理下一个连接请求
   */
  async processNextRequest() {
    if (this.pendingRequests.length === 0) {
      return;
    }
    
    // 尝试使用可用连接
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop();
      const request = this.pendingRequests.shift();
      
      connection._lastUsed = Date.now();
      this.activeConnections.add(connection);
      
      this.logger.debug('Connection acquired from pool', {
        connectionId: connection._connectionId,
        activeConnections: this.activeConnections.size,
        availableConnections: this.availableConnections.length
      });
      
      request.resolve(connection);
      return;
    }
    
    // 如果还能创建新连接
    if (this.connections.length < this.maxConnections) {
      try {
        const connection = await this.createConnection();
        const request = this.pendingRequests.shift();
        
        this.connections.push(connection);
        this.activeConnections.add(connection);
        
        this.logger.debug('New connection created and acquired', {
          connectionId: connection._connectionId,
          totalConnections: this.connections.length,
          activeConnections: this.activeConnections.size
        });
        
        request.resolve(connection);
      } catch (error) {
        const request = this.pendingRequests.shift();
        if (request) {
          request.reject(error);
        }
      }
    }
  }
  
  /**
   * 释放连接
   */
  release(connection) {
    if (!connection || !this.activeConnections.has(connection)) {
      this.logger.warn('Attempted to release invalid or already released connection', {
        connectionId: connection?._connectionId
      });
      return;
    }
    
    // 如果连接在事务中，回滚事务
    if (connection._isInTransaction) {
      this.logger.warn('Releasing connection with active transaction, rolling back', {
        connectionId: connection._connectionId
      });
      connection.run('ROLLBACK', (err) => {
        if (err) {
          this.logger.error('Failed to rollback transaction on connection release', {
            connectionId: connection._connectionId,
            error: err.message
          }, err);
        }
      });
      connection._isInTransaction = false;
    }
    
    this.activeConnections.delete(connection);
    connection._lastUsed = Date.now();
    
    // 如果有等待的请求，直接分配给下一个请求
    if (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      this.activeConnections.add(connection);
      
      this.logger.debug('Connection reassigned to pending request', {
        connectionId: connection._connectionId,
        pendingRequests: this.pendingRequests.length
      });
      
      request.resolve(connection);
    } else {
      this.availableConnections.push(connection);
      
      this.logger.debug('Connection returned to pool', {
        connectionId: connection._connectionId,
        availableConnections: this.availableConnections.length
      });
    }
  }
  
  /**
   * 设置空闲连接清理
   */
  setupIdleConnectionCleanup() {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // 每分钟检查一次
  }
  
  /**
   * 清理空闲连接
   */
  cleanupIdleConnections() {
    const now = Date.now();
    const connectionsToRemove = [];
    
    // 只清理超过最小连接数的空闲连接
    for (let i = this.availableConnections.length - 1; i >= 0; i--) {
      const connection = this.availableConnections[i];
      
      if (now - connection._lastUsed > this.idleTimeout && 
          this.connections.length > this.minConnections) {
        connectionsToRemove.push(connection);
        this.availableConnections.splice(i, 1);
      }
    }
    
    // 关闭空闲连接
    connectionsToRemove.forEach(connection => {
      this.closeConnection(connection);
      const index = this.connections.indexOf(connection);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    });
    
    if (connectionsToRemove.length > 0) {
      this.logger.debug('Cleaned up idle connections', {
        removedConnections: connectionsToRemove.length,
        totalConnections: this.connections.length,
        availableConnections: this.availableConnections.length
      });
    }
  }
  
  /**
   * 关闭单个连接
   */
  closeConnection(connection) {
    if (connection) {
      connection.close((err) => {
        if (err) {
          this.logger.error('Error closing SQLite connection', {
            connectionId: connection._connectionId,
            error: err.message
          }, err);
        } else {
          this.logger.debug('SQLite connection closed', {
            connectionId: connection._connectionId
          });
        }
      });
    }
  }
  
  /**
   * 获取连接池状态
   */
  getStatus() {
    return {
      totalConnections: this.connections.length,
      activeConnections: this.activeConnections.size,
      availableConnections: this.availableConnections.length,
      pendingRequests: this.pendingRequests.length,
      maxConnections: this.maxConnections,
      minConnections: this.minConnections,
      isInitialized: this.isInitialized,
      isDestroyed: this.isDestroyed
    };
  }
  
  /**
   * 销毁连接池
   */
  async destroy() {
    if (this.isDestroyed) {
      return;
    }
    
    this.logger.info('Destroying SQLite connection pool');
    this.isDestroyed = true;
    
    // 拒绝所有等待的请求
    this.pendingRequests.forEach(request => {
      request.reject(ErrorHandler.createError(SQLITE_ERROR_CODES.CONNECTION_FAILED, {
        reason: 'Connection pool is being destroyed'
      }));
    });
    this.pendingRequests = [];
    
    // 关闭所有连接
    const allConnections = [...this.connections];
    const closePromises = allConnections.map(connection => {
      return new Promise((resolve) => {
        connection.close((err) => {
          if (err) {
            this.logger.error('Error closing connection during pool destruction', {
              connectionId: connection._connectionId,
              error: err.message
            }, err);
          }
          resolve();
        });
      });
    });
    
    await Promise.all(closePromises);
    
    this.connections = [];
    this.availableConnections = [];
    this.activeConnections.clear();
    
    this.logger.info('SQLite connection pool destroyed');
  }
}

/**
 * SQLite连接管理器主类
 */
class SQLiteConnectionManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.logger = getLogger('SQLiteConnectionManager');
    this.pool = null;
    this.isInitialized = false;
    
    // 绑定方法以保持this上下文
    this.getConnection = this.getConnection.bind(this);
    this.releaseConnection = this.releaseConnection.bind(this);
    this.executeTransaction = this.executeTransaction.bind(this);
  }
  
  /**
   * 初始化连接管理器
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      this.logger.info('Initializing SQLite connection manager');
      
      const dbConfig = this.configManager.get('database.sqlite', {});
      const dbPath = dbConfig.path || path.join(process.cwd(), 'data', 'qianniu.db');
      
      const poolOptions = {
        dbPath,
        maxConnections: dbConfig.maxConnections || 10,
        minConnections: dbConfig.minConnections || 2,
        acquireTimeout: dbConfig.acquireTimeout || 30000,
        idleTimeout: dbConfig.idleTimeout || 300000
      };
      
      this.pool = new SQLiteConnectionPool(poolOptions);
      await this.pool.initialize();
      
      this.isInitialized = true;
      this.logger.info('SQLite connection manager initialized successfully', {
        dbPath,
        poolConfig: poolOptions
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize SQLite connection manager', { error: error.message }, error);
      throw error;
    }
  }
  
  /**
   * 获取数据库连接
   */
  async getConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return await this.pool.acquire();
  }
  
  /**
   * 释放数据库连接
   */
  releaseConnection(connection) {
    if (this.pool) {
      this.pool.release(connection);
    }
  }
  
  /**
   * 执行事务
   */
  async executeTransaction(callback) {
    const connection = await this.getConnection();
    
    try {
      // 开始事务
      await this.runQuery(connection, 'BEGIN TRANSACTION');
      connection._isInTransaction = true;
      
      this.logger.debug('Transaction started', {
        connectionId: connection._connectionId
      });
      
      // 执行事务回调
      const result = await callback(connection);
      
      // 提交事务
      await this.runQuery(connection, 'COMMIT');
      connection._isInTransaction = false;
      
      this.logger.debug('Transaction committed', {
        connectionId: connection._connectionId
      });
      
      return result;
      
    } catch (error) {
      // 回滚事务
      try {
        await this.runQuery(connection, 'ROLLBACK');
        connection._isInTransaction = false;
        
        this.logger.debug('Transaction rolled back', {
          connectionId: connection._connectionId,
          error: error.message
        });
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          connectionId: connection._connectionId,
          originalError: error.message,
          rollbackError: rollbackError.message
        }, rollbackError);
      }
      
      throw ErrorHandler.wrapError(error, SQLITE_ERROR_CODES.TRANSACTION_FAILED, {
        connectionId: connection._connectionId
      });
      
    } finally {
      this.releaseConnection(connection);
    }
  }
  
  /**
   * 执行SQL查询（Promise包装）
   */
  runQuery(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
      connection.run(sql, params, function(err) {
        if (err) {
          reject(ErrorHandler.wrapError(err, SQLITE_ERROR_CODES.QUERY_FAILED, {
            sql,
            params,
            connectionId: connection._connectionId
          }));
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }
  
  /**
   * 执行查询并返回单行结果
   */
  getQuery(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
      connection.get(sql, params, (err, row) => {
        if (err) {
          reject(ErrorHandler.wrapError(err, SQLITE_ERROR_CODES.QUERY_FAILED, {
            sql,
            params,
            connectionId: connection._connectionId
          }));
        } else {
          resolve(row);
        }
      });
    });
  }
  
  /**
   * 执行查询并返回所有结果
   */
  allQuery(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
      connection.all(sql, params, (err, rows) => {
        if (err) {
          reject(ErrorHandler.wrapError(err, SQLITE_ERROR_CODES.QUERY_FAILED, {
            sql,
            params,
            connectionId: connection._connectionId
          }));
        } else {
          resolve(rows || []);
        }
      });
    });
  }
  
  /**
   * 执行预处理语句
   */
  async prepareStatement(connection, sql) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(sql, (err) => {
        if (err) {
          reject(ErrorHandler.wrapError(err, SQLITE_ERROR_CODES.QUERY_FAILED, {
            sql,
            connectionId: connection._connectionId
          }));
        } else {
          resolve(stmt);
        }
      });
    });
  }
  
  /**
   * 获取连接池状态
   */
  getStatus() {
    if (!this.pool) {
      return {
        isInitialized: this.isInitialized,
        pool: null
      };
    }
    
    return {
      isInitialized: this.isInitialized,
      pool: this.pool.getStatus()
    };
  }
  
  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const connection = await this.getConnection();
      
      try {
        await this.getQuery(connection, 'SELECT 1 as health_check');
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          pool: this.getStatus()
        };
      } finally {
        this.releaseConnection(connection);
      }
      
    } catch (error) {
      this.logger.error('SQLite health check failed', { error: error.message }, error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        pool: this.getStatus()
      };
    }
  }
  
  /**
   * 关闭连接管理器
   */
  async close() {
    if (this.pool) {
      this.logger.info('Closing SQLite connection manager');
      await this.pool.destroy();
      this.pool = null;
      this.isInitialized = false;
      this.logger.info('SQLite connection manager closed');
    }
  }
}

// 导出
export {
  SQLiteConnectionManager,
  SQLiteConnectionPool,
  SQLITE_ERROR_CODES
};

export default SQLiteConnectionManager;