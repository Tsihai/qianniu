/**
 * 智能缓存管理系统
 * 
 * @description 提供多层级缓存策略，包括内存缓存、本地存储缓存和网络缓存
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 多层级缓存策略
 * - TTL（生存时间）管理
 * - 自动清理过期缓存
 * - 缓存统计和监控
 * - 支持缓存预热
 * - 内存使用优化
 */

interface CacheItem<T = any> {
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  memoryUsage: number
}

interface CacheConfig {
  maxSize: number
  defaultTTL: number
  cleanupInterval: number
  enableStats: boolean
  enableLocalStorage: boolean
}

class SmartCache {
  private cache = new Map<string, CacheItem>()
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, memoryUsage: 0 }
  private cleanupTimer: NodeJS.Timeout | null = null
  private config: CacheConfig

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 60 * 1000, // 1分钟
      enableStats: true,
      enableLocalStorage: true,
      ...config
    }

    this.startCleanupTimer()
    this.loadFromLocalStorage()
  }

  /**
   * 设置缓存项
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now()
    const itemTTL = ttl || this.config.defaultTTL

    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    const item: CacheItem<T> = {
      value,
      timestamp: now,
      ttl: itemTTL,
      accessCount: 0,
      lastAccessed: now
    }

    this.cache.set(key, item)
    this.updateStats()
    this.saveToLocalStorage(key, item)
  }

  /**
   * 获取缓存项
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      this.stats.misses++
      return null
    }

    const now = Date.now()
    
    // 检查是否过期
    if (now - item.timestamp > item.ttl) {
      this.delete(key)
      this.stats.misses++
      return null
    }

    // 更新访问信息
    item.accessCount++
    item.lastAccessed = now
    this.stats.hits++

    return item.value as T
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats()
      this.removeFromLocalStorage(key)
    }
    return deleted
  }

  /**
   * 检查缓存项是否存在且未过期
   */
  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    const now = Date.now()
    if (now - item.timestamp > item.ttl) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, size: 0, memoryUsage: 0 }
    this.clearLocalStorage()
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses
    return total === 0 ? 0 : this.stats.hits / total
  }

  /**
   * 批量设置缓存
   */
  setMany<T>(entries: Array<[string, T, number?]>): void {
    entries.forEach(([key, value, ttl]) => {
      this.set(key, value, ttl)
    })
  }

  /**
   * 批量获取缓存
   */
  getMany<T>(keys: string[]): Array<T | null> {
    return keys.map(key => this.get<T>(key))
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * 缓存预热
   */
  async warmup<T>(loader: (key: string) => Promise<T>, keys: string[], ttl?: number): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const value = await loader(key)
          this.set(key, value, ttl)
        } catch (error) {
          console.warn(`Failed to warm up cache for key: ${key}`, error)
        }
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.delete(key))
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.size = this.cache.size
    this.stats.memoryUsage = this.estimateMemoryUsage()
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    let size = 0
    for (const [key, item] of this.cache.entries()) {
      size += key.length * 2 // 字符串按2字节计算
      size += JSON.stringify(item).length * 2
    }
    return size
  }

  /**
   * 保存到本地存储
   */
  private saveToLocalStorage(key: string, item: CacheItem): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') return

    try {
      const storageKey = `cache_${key}`
      localStorage.setItem(storageKey, JSON.stringify(item))
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }

  /**
   * 从本地存储加载
   */
  private loadFromLocalStorage(): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') return

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache_')) {
          const cacheKey = key.replace('cache_', '')
          const itemStr = localStorage.getItem(key)
          if (itemStr) {
            const item: CacheItem = JSON.parse(itemStr)
            const now = Date.now()
            
            // 检查是否过期
            if (now - item.timestamp <= item.ttl) {
              this.cache.set(cacheKey, item)
            } else {
              localStorage.removeItem(key)
            }
          }
        }
      }
      this.updateStats()
    } catch (error) {
      console.warn('Failed to load from localStorage:', error)
    }
  }

  /**
   * 从本地存储移除
   */
  private removeFromLocalStorage(key: string): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') return

    try {
      localStorage.removeItem(`cache_${key}`)
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error)
    }
  }

  /**
   * 清空本地存储
   */
  private clearLocalStorage(): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') return

    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    this.stopCleanupTimer()
    this.clear()
  }
}

// 创建默认缓存实例
export const defaultCache = new SmartCache()

// 创建专用缓存实例
export const metricsCache = new SmartCache({
  maxSize: 500,
  defaultTTL: 30 * 1000, // 30秒
  enableLocalStorage: false // 实时数据不需要持久化
})

export const configCache = new SmartCache({
  maxSize: 100,
  defaultTTL: 10 * 60 * 1000, // 10分钟
  enableLocalStorage: true // 配置数据需要持久化
})

export { SmartCache }
export type { CacheConfig, CacheStats, CacheItem }