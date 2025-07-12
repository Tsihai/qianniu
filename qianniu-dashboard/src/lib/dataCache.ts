"use client"

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined'

// 数据库配置
const DB_NAME = 'qianniu-dashboard-cache'
const DB_VERSION = 1
const STORES = {
  REAL_TIME_DATA: 'realTimeData',
  METRICS_DATA: 'metricsData',
  WEBSOCKET_DATA: 'websocketData',
  PERFORMANCE_DATA: 'performanceData'
} as const

// 数据库模式定义
interface CacheDBSchema extends DBSchema {
  [STORES.REAL_TIME_DATA]: {
    key: string
    value: {
      id: string
      data: unknown
      timestamp: number
      expiresAt?: number
      metadata?: Record<string, unknown>
    }
    indexes: {
      timestamp: number
      expiresAt: number
    }
  }
  [STORES.METRICS_DATA]: {
    key: string
    value: {
      id: string
      data: any
      timestamp: number
      expiresAt?: number
      metadata?: Record<string, unknown>
    }
    indexes: {
      timestamp: number
      expiresAt: number
    }
  }
  [STORES.WEBSOCKET_DATA]: {
    key: string
    value: {
      id: string
      data: any
      timestamp: number
      expiresAt?: number
      metadata?: Record<string, unknown>
    }
    indexes: {
      timestamp: number
      expiresAt: number
    }
  }
  [STORES.PERFORMANCE_DATA]: {
    key: string
    value: {
      id: string
      data: any
      timestamp: number
      expiresAt?: number
      metadata?: Record<string, any>
    }
    indexes: {
      timestamp: number
      expiresAt: number
    }
  }
}

// 缓存项类型
export interface CacheItem<T = unknown> {
  id: string
  data: T
  timestamp: number
  expiresAt?: number
  metadata?: Record<string, unknown>
}

// 缓存配置
export interface CacheConfig {
  defaultTTL?: number
  maxItems?: number
  enableAutoCleanup?: boolean
  cleanupInterval?: number
}

// 默认配置
const DEFAULT_CONFIG: Required<CacheConfig> = {
  defaultTTL: 24 * 60 * 60 * 1000, // 24小时
  maxItems: 1000,
  enableAutoCleanup: true,
  cleanupInterval: 60 * 60 * 1000 // 1小时
}

/**
 * 数据缓存管理器
 * 使用IndexedDB进行数据持久化存储
 */
export class DataCache {
  private db: IDBPDatabase<CacheDBSchema> | null = null
  private config: Required<CacheConfig>
  private cleanupTimer: NodeJS.Timeout | null = null
  private initPromise: Promise<void> | null = null
  private isInitialized: boolean = false
  private isBrowserEnv: boolean = isBrowser

  constructor(config: CacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // 只在浏览器环境中初始化
    if (this.isBrowserEnv) {
      this.initPromise = this.init()
    }
  }

  /**
   * 初始化数据库
   */
  private async init(): Promise<void> {
    if (!this.isBrowserEnv) {
      console.warn('DataCache: 非浏览器环境，IndexedDB不可用')
      return
    }
    
    try {
      this.db = await openDB<CacheDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 创建存储对象
          Object.values(STORES).forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'id' })
              store.createIndex('timestamp', 'timestamp')
              store.createIndex('expiresAt', 'expiresAt')
            }
          })
        },
        blocked() {
          console.warn('数据库升级被阻塞，请关闭其他标签页')
        },
        blocking() {
          console.warn('数据库正在升级，请等待')
        }
      })

      // 启动自动清理
      if (this.config.enableAutoCleanup) {
        this.startAutoCleanup()
      }

      this.isInitialized = true
      console.log('数据缓存初始化成功')
    } catch (error) {
      console.error('数据缓存初始化失败:', error)
      throw error
    }
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isBrowserEnv) {
      throw new Error('当前环境不支持IndexedDB')
    }

    if (!this.isInitialized && this.initPromise) {
      await this.initPromise
    }

    if (!this.db) {
      throw new Error('数据库未初始化')
    }
  }

  /**
   * 启动自动清理定时器
   */
  private startAutoCleanup(): void {
    if (!this.isBrowserEnv) return

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(err => console.error('自动清理失败:', err))
    }, this.config.cleanupInterval)
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 设置缓存项
   */
  async set<T>(
    store: keyof typeof STORES, 
    id: string, 
    data: T, 
    options: { 
      ttl?: number,
      metadata?: Record<string, unknown>,
      overwrite?: boolean
    } = {}
  ): Promise<void> {
    if (!this.isBrowserEnv) return

    try {
      await this.ensureInitialized()
      
      const { ttl, metadata, overwrite = true } = options
      const storeName = STORES[store]
      const now = Date.now()
      const expiresAt = ttl ? now + ttl : now + this.config.defaultTTL
      
      const item: CacheItem<T> = {
        id,
        data,
        timestamp: now,
        expiresAt,
        metadata
      }
      
      const tx = this.db!.transaction([storeName], 'readwrite')
      const objectStore = tx.objectStore(storeName)
      
      // 如果不覆盖，先检查是否存在
      if (!overwrite) {
        const existing = await objectStore.get(id)
        if (existing) {
          return
        }
      }
      
      await objectStore.put(item)
      await tx.done
      
      // 检查是否需要强制执行最大项目限制
      await this.enforceMaxItems(storeName)
    } catch (error) {
      console.error(`设置缓存项失败 [${store}] [${id}]:`, error)
      throw error
    }
  }

  /**
   * 获取缓存项
   */
  async get<T>(store: keyof typeof STORES, id: string): Promise<CacheItem<T> | null> {
    if (!this.isBrowserEnv) return null
    
    try {
      await this.ensureInitialized()
      
      const storeName = STORES[store]
      const item = await this.db!.get(storeName, id) as CacheItem<T> | undefined
      
      // 检查项目是否存在且未过期
      if (item) {
        if (!item.expiresAt || Date.now() <= item.expiresAt) {
          return item
        } else {
          // 如果已过期，删除它
          await this.delete(store, id)
        }
      }
      
      return null
    } catch (error) {
      console.error(`获取缓存项失败 [${store}] [${id}]:`, error)
      return null
    }
  }

  /**
   * 获取所有缓存项
   */
  async getAll<T>(
    store: keyof typeof STORES,
    options: {
      limit?: number
      offset?: number
      sortBy?: 'timestamp' | 'expiresAt'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<CacheItem<T>[]> {
    if (!this.isBrowserEnv) return []
    
    await this.ensureInitialized()

    try {
      const { limit, offset = 0, sortBy = 'timestamp', sortOrder = 'desc' } = options
      const storeName = STORES[store] as keyof CacheDBSchema
      const tx = this.db!.transaction([storeName as any], 'readonly')
      const objectStore = tx.objectStore(storeName as any)
      const index = (objectStore as any).index(sortBy)
      
      let cursor = await index.openCursor(null, sortOrder === 'desc' ? 'prev' : 'next')
      const items: CacheItem<T>[] = []
      let count = 0

      while (cursor && (!limit || items.length < limit)) {
        if (count >= offset) {
          const item = cursor.value as CacheItem<T>
          
          // 检查是否过期
          if (!item.expiresAt || Date.now() <= item.expiresAt) {
            items.push(item)
          }
        }
        count++
        cursor = await cursor.continue()
      }

      return items
    } catch (error) {
      console.error(`获取所有缓存项失败 [${store}]:`, error)
      return []
    }
  }

  /**
   * 删除缓存项
   */
  async delete(store: keyof typeof STORES, id: string): Promise<void> {
    if (!this.isBrowserEnv) return
    
    try {
      await this.ensureInitialized()
      
      const storeName = STORES[store]
      await this.db!.delete(storeName, id)
    } catch (error) {
      console.error(`删除缓存项失败 [${store}] [${id}]:`, error)
    }
  }

  /**
   * 清空存储
   */
  async clear(store: keyof typeof STORES): Promise<void> {
    if (!this.isBrowserEnv) return
    
    try {
      await this.ensureInitialized()
      
      const storeName = STORES[store]
      await this.db!.clear(storeName)
    } catch (error) {
      console.error(`清空存储失败 [${store}]:`, error)
    }
  }

  /**
   * 清空所有存储
   */
  async clearAll(): Promise<void> {
    if (!this.isBrowserEnv) return
    
    try {
      await this.ensureInitialized()
      
      for (const storeKey of Object.keys(STORES) as (keyof typeof STORES)[]) {
        await this.clear(storeKey)
      }
    } catch (error) {
      console.error('清空所有存储失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<Record<string, { count: number, size: string }>> {
    if (!this.isBrowserEnv) return {}
    
    try {
      await this.ensureInitialized()
      
      const stats: Record<string, { count: number, size: string }> = {}
      
      for (const storeKey of Object.keys(STORES) as (keyof typeof STORES)[]) {
        const storeName = STORES[storeKey]
        const tx = this.db!.transaction([storeName], 'readonly')
        const store = tx.objectStore(storeName)
        const count = await store.count()
        
        // 获取大小（估计）
        const items = await this.getAll(storeKey, { limit: 10 })
        let avgSize = 0
        
        if (items.length > 0) {
          const totalSize = items.reduce((size, item) => {
            return size + new Blob([JSON.stringify(item)]).size
          }, 0)
          avgSize = totalSize / items.length
        }
        
        const estimatedSize = count * avgSize
        const sizeStr = this.formatSize(estimatedSize)
        
        stats[storeKey] = { count, size: sizeStr }
      }
      
      return stats
    } catch (error) {
      console.error('获取缓存统计信息失败:', error)
      return {}
    }
  }

  /**
   * 格式化大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  /**
   * 清理过期项
   */
  async cleanupExpired(): Promise<number> {
    if (!this.isBrowserEnv) return 0
    
    await this.ensureInitialized()

    let totalCleaned = 0
    const now = Date.now()

    for (const storeKey of Object.keys(STORES) as (keyof typeof STORES)[]) {
        try {
          const storeName = STORES[storeKey] as keyof CacheDBSchema
          const tx = this.db!.transaction([storeName as any], 'readwrite')
        const store = tx.objectStore(storeName as any)
         const index = (store as any).index('expiresAt')
        
        // 获取所有过期项
        const range = IDBKeyRange.upperBound(now)
        let cursor = await index.openCursor(range)
        
        while (cursor) {
          await cursor.delete()
          totalCleaned++
          cursor = await cursor.continue()
        }
        
        await tx.done
      } catch (error) {
        console.error(`清理过期项失败 [${storeKey}]:`, error)
      }
    }

    if (totalCleaned > 0) {
      console.log(`清理了 ${totalCleaned} 个过期缓存项`)
    }

    return totalCleaned
  }

  /**
   * 强制执行最大项数限制
   */
  private async enforceMaxItems(storeName: keyof CacheDBSchema): Promise<void> {
    if (!this.isBrowserEnv) return
    
    try {
      const tx = this.db!.transaction([storeName as any], 'readwrite')
      const store = tx.objectStore(storeName as any)
      const count = await store.count()
      
      if (count > this.config.maxItems) {
        const excess = count - this.config.maxItems
        const index = (store as any).index('timestamp')
        let cursor = await index.openCursor() // 从最旧的开始
        let deleted = 0
        
        while (cursor && deleted < excess) {
          await cursor.delete()
          deleted++
          cursor = await cursor.continue()
        }
        
        await tx.done
        console.log(`删除了 ${deleted} 个最旧的缓存项以维持最大限制`)
      }
    } catch (error) {
      console.error('强制执行最大项数限制失败:', error)
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    this.stopAutoCleanup()
  }

  /**
   * 检查浏览器是否支持IndexedDB
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window
  }
}

// 创建全局缓存实例
let globalCache: DataCache | null = null

/**
 * 获取全局缓存实例
 */
export function getGlobalCache(config?: CacheConfig): DataCache {
  if (!globalCache) {
    if (typeof window === 'undefined') {
      // 服务器端返回一个空的实现
      return new DataCache(config)
    }
    
    if (!DataCache.isSupported()) {
      throw new Error('当前浏览器不支持IndexedDB')
    }
    
    globalCache = new DataCache(config)
  }
  return globalCache
}

/**
 * 销毁全局缓存实例
 */
export async function destroyGlobalCache(): Promise<void> {
  if (globalCache) {
    globalCache.close()
    globalCache = null
  }
}

// 导出存储常量
export { STORES }
export type { CacheDBSchema }