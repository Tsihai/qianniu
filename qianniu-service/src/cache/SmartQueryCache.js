import { SmartConfigCache } from '../config/ConfigManager.js';
import crypto from 'crypto';

/**
 * 智能查询缓存类
 * 扩展SmartConfigCache，支持数据库查询结果缓存、TTL机制和智能缓存策略
 */
class SmartQueryCache extends SmartConfigCache {
  constructor(options = {}) {
    super();
    
    // TTL相关配置
    this.ttlMap = new Map(); // 存储每个键的过期时间
    this.defaultTTL = options.defaultTTL || 300000; // 默认5分钟
    this.maxTTL = options.maxTTL || 3600000; // 最大1小时
    this.minTTL = options.minTTL || 30000; // 最小30秒
    
    // 查询缓存特定配置
    this.queryStats = {
      queryHits: 0,
      queryMisses: 0,
      expiredKeys: 0,
      preloadHits: 0
    };
    
    // 缓存策略配置
    this.strategies = {
      customer: { ttl: 600000, priority: 'high' }, // 客户数据10分钟
      session: { ttl: 300000, priority: 'medium' }, // 会话数据5分钟
      intent: { ttl: 900000, priority: 'high' }, // 意图模板15分钟
      statistics: { ttl: 120000, priority: 'low' } // 统计数据2分钟
    };
    
    // 启动定期清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredKeys();
    }, options.cleanupInterval || 60000); // 每分钟清理一次
  }

  /**
   * 生成查询缓存键
   * @param {string} operation - 操作名称
   * @param {Object} params - 查询参数
   * @returns {string} 缓存键
   */
  generateQueryKey(operation, params = {}) {
    // 创建参数的哈希值确保键的唯一性
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(paramString).digest('hex').substring(0, 8);
    return `query:${operation}:${hash}`;
  }

  /**
   * 设置带TTL的缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 生存时间（毫秒）
   * @param {Object} metadata - 元数据
   */
  setWithTTL(key, value, ttl = this.defaultTTL, metadata = {}) {
    // 验证TTL范围
    ttl = Math.max(this.minTTL, Math.min(this.maxTTL, ttl));
    
    // 设置过期时间
    const expireTime = Date.now() + ttl;
    this.ttlMap.set(key, {
      expireTime,
      ttl,
      metadata: {
        operation: metadata.operation,
        priority: metadata.priority || 'medium',
        createdAt: Date.now(),
        ...metadata
      }
    });
    
    // 调用父类的set方法
    super.set(key, value);
  }

  /**
   * 获取缓存值（检查TTL）
   * @param {string} key - 缓存键
   * @returns {any} 缓存值或null
   */
  get(key) {
    // 检查是否过期
    if (this.isExpired(key)) {
      this._removeExpiredKey(key);
      this.queryStats.queryMisses++;
      return null;
    }
    
    const value = super.get(key);
    if (value !== null) {
      this.queryStats.queryHits++;
      
      // 更新访问时间
      const ttlInfo = this.ttlMap.get(key);
      if (ttlInfo) {
        ttlInfo.metadata.lastAccess = Date.now();
      }
    } else {
      this.queryStats.queryMisses++;
    }
    
    return value;
  }

  /**
   * 检查键是否过期
   * @param {string} key - 缓存键
   * @returns {boolean} 是否过期
   */
  isExpired(key) {
    const ttlInfo = this.ttlMap.get(key);
    if (!ttlInfo) {
      return false; // 没有TTL信息的键不过期
    }
    
    return Date.now() > ttlInfo.expireTime;
  }

  /**
   * 删除缓存（同时清理TTL信息）
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    this.ttlMap.delete(key);
    return super.delete(key);
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.ttlMap.clear();
    super.clear();
  }

  /**
   * 根据操作类型设置查询缓存
   * @param {string} operation - 操作名称
   * @param {Object} params - 查询参数
   * @param {any} result - 查询结果
   * @param {Object} options - 缓存选项
   */
  setQueryResult(operation, params, result, options = {}) {
    const key = this.generateQueryKey(operation, params);
    const strategy = this.strategies[operation] || this.strategies.session;
    
    const ttl = options.ttl || strategy.ttl;
    const metadata = {
      operation,
      priority: strategy.priority,
      params: params,
      resultSize: JSON.stringify(result).length,
      ...options.metadata
    };
    
    this.setWithTTL(key, result, ttl, metadata);
  }

  /**
   * 获取查询缓存结果
   * @param {string} operation - 操作名称
   * @param {Object} params - 查询参数
   * @returns {any} 缓存的查询结果或null
   */
  getQueryResult(operation, params) {
    const key = this.generateQueryKey(operation, params);
    return this.get(key);
  }

  /**
   * 使查询缓存失效
   * @param {string} operation - 操作名称
   * @param {Object} params - 查询参数（可选，不提供则清除该操作的所有缓存）
   */
  invalidateQuery(operation, params = null) {
    if (params) {
      // 失效特定查询
      const key = this.generateQueryKey(operation, params);
      this.delete(key);
    } else {
      // 失效操作的所有查询
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`query:${operation}:`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.delete(key));
    }
  }

  /**
   * 预热缓存
   * @param {Array} preloadQueries - 预加载查询列表
   * @param {Function} queryFunction - 查询函数
   */
  async preloadCache(preloadQueries, queryFunction) {
    const preloadPromises = preloadQueries.map(async ({ operation, params, ttl }) => {
      try {
        const key = this.generateQueryKey(operation, params);
        
        // 检查是否已缓存且未过期
        if (this.has(key) && !this.isExpired(key)) {
          this.queryStats.preloadHits++;
          return;
        }
        
        // 执行查询并缓存结果
        const result = await queryFunction(operation, params);
        this.setQueryResult(operation, params, result, { ttl });
      } catch (error) {
        console.warn(`预加载查询失败 ${operation}:`, error.message);
      }
    });
    
    await Promise.all(preloadPromises);
  }

  /**
   * 获取查询缓存统计信息
   * @returns {Object} 统计信息
   */
  getQueryStats() {
    const baseStats = super.getStats();
    const queryHitRate = this.queryStats.queryHits + this.queryStats.queryMisses > 0
      ? (this.queryStats.queryHits / (this.queryStats.queryHits + this.queryStats.queryMisses) * 100).toFixed(2)
      : 0;
    
    return {
      ...baseStats,
      query: {
        ...this.queryStats,
        queryHitRate: `${queryHitRate}%`,
        activeTTLKeys: this.ttlMap.size,
        strategies: Object.keys(this.strategies)
      },
      ttl: {
        defaultTTL: this.defaultTTL,
        maxTTL: this.maxTTL,
        minTTL: this.minTTL
      }
    };
  }

  /**
   * 获取缓存管理接口
   * @returns {Object} 管理接口
   */
  getManagementInterface() {
    return {
      // 获取所有缓存键信息
      getAllKeys: () => {
        const keys = [];
        for (const [key, entry] of this.cache.entries()) {
          const ttlInfo = this.ttlMap.get(key);
          keys.push({
            key,
            size: JSON.stringify(entry.data).length,
            compressed: entry.compressed,
            accessCount: entry.accessCount,
            createdAt: entry.timestamp,
            lastAccess: entry.lastAccess,
            ttl: ttlInfo ? {
              expireTime: ttlInfo.expireTime,
              ttl: ttlInfo.ttl,
              isExpired: this.isExpired(key),
              metadata: ttlInfo.metadata
            } : null
          });
        }
        return keys;
      },
      
      // 手动清理过期键
      cleanupExpired: () => this._cleanupExpiredKeys(),
      
      // 更新缓存策略
      updateStrategy: (operation, strategy) => {
        this.strategies[operation] = { ...this.strategies[operation], ...strategy };
      },
      
      // 获取缓存策略
      getStrategies: () => ({ ...this.strategies })
    };
  }

  /**
   * 清理过期的缓存键
   * @private
   */
  _cleanupExpiredKeys() {
    const expiredKeys = [];
    
    for (const [key, ttlInfo] of this.ttlMap.entries()) {
      if (Date.now() > ttlInfo.expireTime) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this._removeExpiredKey(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存键`);
    }
  }

  /**
   * 移除过期键
   * @private
   * @param {string} key - 缓存键
   */
  _removeExpiredKey(key) {
    this.ttlMap.delete(key);
    super.delete(key);
    this.queryStats.expiredKeys++;
  }

  /**
   * 销毁缓存实例
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

export default SmartQueryCache;