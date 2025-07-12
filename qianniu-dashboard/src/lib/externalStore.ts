"use client"

import { DataCache, getGlobalCache, CacheItem } from './dataCache'

// 存储状态接口
export interface StoreState<T = any> {
  data: T
  loading: boolean
  error: Error | null
  lastUpdated: number
  version: number
}

// 存储配置
export interface StoreConfig<T = unknown> {
  /** 缓存键 */
  cacheKey?: string
  /** 缓存存储类型 */
  cacheStore?: 'REAL_TIME_DATA' | 'METRICS_DATA' | 'WEBSOCKET_DATA' | 'PERFORMANCE_DATA'
  /** 缓存TTL（毫秒） */
  cacheTTL?: number
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 是否启用离线恢复 */
  enableOfflineRecovery?: boolean
  /** 数据验证函数 */
  validator?: (data: unknown) => boolean
  /** 数据转换函数 */
  transformer?: (data: unknown) => T
}

// 订阅者类型
type Subscriber<T> = (state: StoreState<T>) => void

/**
 * 外部存储管理器
 * 实现React 19的useSyncExternalStore模式
 */
export class ExternalStore<T = unknown> {
  private state: StoreState<T>
  private subscribers = new Set<Subscriber<T>>()
  private cache: DataCache | null = null
  private config: StoreConfig
  private isInitialized = false

  constructor(
    initialData: T,
    config: StoreConfig<T> = {}
  ) {
    this.config = {
      enableCache: true,
      enableOfflineRecovery: true,
      cacheStore: 'REAL_TIME_DATA',
      cacheTTL: 24 * 60 * 60 * 1000, // 24小时
      ...config
    }

    this.state = {
      data: initialData,
      loading: false,
      error: null,
      lastUpdated: Date.now(),
      version: 0
    }

    if (this.config.enableCache) {
      this.initializeCache()
    }
  }

  /**
   * 初始化缓存
   */
  private async initializeCache(): Promise<void> {
    try {
      this.cache = getGlobalCache()
      
      // 尝试从缓存恢复数据
      if (this.config.enableOfflineRecovery && this.config.cacheKey) {
        await this.recoverFromCache()
      }
      
      this.isInitialized = true
    } catch (error) {
      console.error('缓存初始化失败:', error)
      this.isInitialized = true // 即使缓存失败也要继续
    }
  }

  /**
   * 从缓存恢复数据
   */
  private async recoverFromCache(): Promise<void> {
    if (!this.cache || !this.config.cacheKey || !this.config.cacheStore) {
      return
    }

    try {
      const cachedItem = await this.cache.get<StoreState<T>>(
        this.config.cacheStore,
        this.config.cacheKey
      )

      if (cachedItem && cachedItem.data) {
        // 验证缓存数据
        if (this.config.validator && !this.config.validator(cachedItem.data.data)) {
          console.warn('缓存数据验证失败，使用默认数据')
          return
        }

        // 转换缓存数据
        let recoveredData = cachedItem.data.data
        if (this.config.transformer) {
          recoveredData = this.config.transformer(recoveredData) as T
        }

        this.state = {
          ...cachedItem.data,
          data: recoveredData,
          loading: false,
          error: null
        }

        console.log('从缓存恢复数据成功:', this.config.cacheKey)
      }
    } catch (error) {
      console.error('从缓存恢复数据失败:', error)
    }
  }

  /**
   * 保存到缓存
   */
  private async saveToCache(): Promise<void> {
    if (!this.cache || !this.config.cacheKey || !this.config.cacheStore || !this.config.enableCache) {
      return
    }

    try {
      await this.cache.set(
        this.config.cacheStore,
        this.config.cacheKey,
        this.state,
        {
          ttl: this.config.cacheTTL,
          metadata: {
            storeType: 'ExternalStore',
            version: this.state.version,
            lastUpdated: this.state.lastUpdated
          }
        }
      )
    } catch (error) {
      console.error('保存到缓存失败:', error)
    }
  }

  /**
   * 获取当前状态
   */
  getState(): StoreState<T> {
    return this.state
  }

  /**
   * 获取快照（用于useSyncExternalStore）
   */
  getSnapshot = (): StoreState<T> => {
    return this.state
  }

  /**
   * 获取服务器端快照（用于useSyncExternalStore）
   */
  getServerSnapshot = (): StoreState<T> => {
    return this.state
  }

  /**
   * 订阅状态变化（用于useSyncExternalStore）
   */
  subscribe = (callback: Subscriber<T>): (() => void) => {
    this.subscribers.add(callback)
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * 通知所有订阅者
   */
  private notify(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state)
      } catch (error) {
        console.error('订阅者回调执行失败:', error)
      }
    })
  }

  /**
   * 设置数据
   */
  async setData(data: T, options: {
    loading?: boolean
    error?: Error | null
    skipCache?: boolean
  } = {}): Promise<void> {
    const { loading = false, error = null, skipCache = false } = options

    // 验证数据
    if (this.config.validator && !this.config.validator(data)) {
      throw new Error('数据验证失败')
    }

    // 转换数据
    let transformedData = data
    if (this.config.transformer) {
      transformedData = this.config.transformer(data) as T
    }

    const newState: StoreState<T> = {
      data: transformedData,
      loading,
      error,
      lastUpdated: Date.now(),
      version: this.state.version + 1
    }

    this.state = newState
    this.notify()

    // 保存到缓存
    if (!skipCache) {
      await this.saveToCache()
    }
  }

  /**
   * 设置加载状态
   */
  setLoading(loading: boolean): void {
    if (this.state.loading !== loading) {
      this.state = {
        ...this.state,
        loading,
        version: this.state.version + 1
      }
      this.notify()
    }
  }

  /**
   * 设置错误状态
   */
  setError(error: Error | null): void {
    this.state = {
      ...this.state,
      error,
      loading: false,
      version: this.state.version + 1
    }
    this.notify()
  }

  /**
   * 更新部分数据
   */
  async updateData(
    updater: (currentData: T) => T,
    options: { skipCache?: boolean } = {}
  ): Promise<void> {
    const newData = updater(this.state.data)
    await this.setData(newData, options)
  }

  /**
   * 重置状态
   */
  async reset(initialData?: T): Promise<void> {
    const data = initialData ?? this.state.data
    await this.setData(data, { loading: false, error: null })
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    if (this.cache && this.config.cacheKey && this.config.cacheStore) {
      try {
        await this.cache.delete(this.config.cacheStore, this.config.cacheKey)
      } catch (error) {
        console.error('清除缓存失败:', error)
      }
    }
  }

  /**
   * 获取缓存信息
   */
  async getCacheInfo(): Promise<CacheItem<StoreState<T>> | null> {
    if (!this.cache || !this.config.cacheKey || !this.config.cacheStore) {
      return null
    }

    try {
      return await this.cache.get<StoreState<T>>(
        this.config.cacheStore,
        this.config.cacheKey
      )
    } catch (error) {
      console.error('获取缓存信息失败:', error)
      return null
    }
  }

  /**
   * 等待初始化完成
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve()
        } else {
          setTimeout(checkInitialized, 10)
        }
      }
      checkInitialized()
    })
  }

  /**
   * 销毁存储
   */
  destroy(): void {
    this.subscribers.clear()
    this.cache = null
  }
}

/**
 * 创建外部存储实例
 */
export function createExternalStore<T>(
  initialData: T,
  config?: StoreConfig<T>
): ExternalStore<T> {
  return new ExternalStore(initialData, config)
}

/**
 * 存储管理器
 * 管理多个外部存储实例
 */
export class StoreManager {
  private stores = new Map<string, ExternalStore<any>>()

  /**
   * 创建或获取存储
   */
  getStore<T>(
    key: string,
    initialData: T,
    config?: StoreConfig<T>
  ): ExternalStore<T> {
    if (!this.stores.has(key)) {
      const store = new ExternalStore(initialData, {
        ...config,
        cacheKey: config?.cacheKey || key
      })
      this.stores.set(key, store)
    }
    return this.stores.get(key)!
  }

  /**
   * 删除存储
   */
  deleteStore(key: string): void {
    const store = this.stores.get(key)
    if (store) {
      store.destroy()
      this.stores.delete(key)
    }
  }

  /**
   * 清除所有存储
   */
  clearAll(): void {
    this.stores.forEach(store => store.destroy())
    this.stores.clear()
  }

  /**
   * 获取所有存储键
   */
  getStoreKeys(): string[] {
    return Array.from(this.stores.keys())
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    totalStores: number
    storeKeys: string[]
    totalSubscribers: number
  } {
    let totalSubscribers = 0
    this.stores.forEach(store => {
      totalSubscribers += (store as any).subscribers.size
    })

    return {
      totalStores: this.stores.size,
      storeKeys: this.getStoreKeys(),
      totalSubscribers
    }
  }
}

// 创建全局存储管理器
const globalStoreManager = new StoreManager()

/**
 * 获取全局存储管理器
 */
export function getStoreManager(): StoreManager {
  return globalStoreManager
}

// 导出类型
export type { Subscriber }