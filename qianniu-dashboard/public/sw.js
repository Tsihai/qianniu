/**
 * Service Worker - 缓存策略和离线支持
 * 
 * @description 实现智能缓存策略，提升应用性能和用户体验
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 静态资源缓存
 * - API响应缓存
 * - 离线支持
 * - 缓存更新策略
 * - 性能监控
 */

const CACHE_NAME = 'qianniu-dashboard-v1'
const STATIC_CACHE = 'qianniu-static-v1'
const API_CACHE = 'qianniu-api-v1'
const RUNTIME_CACHE = 'qianniu-runtime-v1'

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/favicon.ico'
]

// API缓存策略配置
const API_CACHE_CONFIG = {
  '/api/metrics': {
    strategy: 'stale-while-revalidate',
    maxAge: 30 * 1000, // 30秒
    maxEntries: 50
  },
  '/api/config': {
    strategy: 'cache-first',
    maxAge: 10 * 60 * 1000, // 10分钟
    maxEntries: 20
  },
  '/api/websocket-status': {
    strategy: 'network-first',
    maxAge: 5 * 1000, // 5秒
    maxEntries: 10
  }
}

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  
  event.waitUntil(
    Promise.all([
      // 预缓存静态资源
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      }),
      // 跳过等待，立即激活
      self.skipWaiting()
    ])
  )
})

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  
  event.waitUntil(
    Promise.all([
      // 清理旧版本缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && 
                     cacheName !== STATIC_CACHE && 
                     cacheName !== API_CACHE && 
                     cacheName !== RUNTIME_CACHE
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      }),
      // 立即控制所有客户端
      self.clients.claim()
    ])
  )
})

// 获取事件 - 处理网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // 只处理同源请求
  if (url.origin !== self.location.origin) {
    return
  }

  // 处理API请求
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // 处理静态资源请求
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request))
    return
  }

  // 处理页面请求
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  // 其他请求使用运行时缓存
  event.respondWith(handleRuntimeRequest(request))
})

/**
 * 处理API请求
 */
async function handleApiRequest(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  
  // 查找匹配的缓存配置
  const cacheConfig = Object.entries(API_CACHE_CONFIG).find(([pattern]) => 
    pathname.includes(pattern)
  )?.[1]

  if (!cacheConfig) {
    // 没有缓存配置，直接网络请求
    return fetch(request)
  }

  const cache = await caches.open(API_CACHE)
  const cacheKey = `${pathname}${url.search}`

  switch (cacheConfig.strategy) {
    case 'cache-first':
      return cacheFirst(request, cache, cacheConfig)
    
    case 'network-first':
      return networkFirst(request, cache, cacheConfig)
    
    case 'stale-while-revalidate':
    default:
      return staleWhileRevalidate(request, cache, cacheConfig)
  }
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request, cache, config) {
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, config.maxEntries)
    }
    return networkResponse
  } catch (error) {
    // 网络失败，返回过期缓存（如果有）
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * 网络优先策略
 */
async function networkFirst(request, cache, config) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, config.maxEntries)
    }
    return networkResponse
  } catch (error) {
    // 网络失败，尝试从缓存获取
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * 过期重新验证策略
 */
async function staleWhileRevalidate(request, cache, config) {
  const cachedResponse = await cache.match(request)
  
  // 后台更新缓存
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, config.maxEntries)
    }
    return networkResponse
  }).catch(() => {
    // 网络错误时忽略
  })

  // 如果有缓存且未过期，立即返回
  if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
    return cachedResponse
  }

  // 否则等待网络响应
  try {
    return await fetchPromise
  } catch (error) {
    // 网络失败，返回过期缓存（如果有）
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * 处理静态资源请求
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url)
    throw error
  }
}

/**
 * 处理页面导航请求
 */
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request)
    return networkResponse
  } catch (error) {
    // 网络失败时返回缓存的首页
    const cache = await caches.open(STATIC_CACHE)
    const fallbackResponse = await cache.match('/')
    
    if (fallbackResponse) {
      return fallbackResponse
    }
    
    throw error
  }
}

/**
 * 处理运行时请求
 */
async function handleRuntimeRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, 100) // 限制运行时缓存大小
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * 检查响应是否过期
 */
function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date')
  if (!dateHeader) return true
  
  const responseTime = new Date(dateHeader).getTime()
  const now = Date.now()
  
  return (now - responseTime) > maxAge
}

/**
 * 清理缓存，保持在最大条目数以内
 */
async function cleanupCache(cache, maxEntries) {
  const keys = await cache.keys()
  
  if (keys.length > maxEntries) {
    // 删除最旧的条目
    const entriesToDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(
      entriesToDelete.map(key => cache.delete(key))
    )
  }
}

/**
 * 判断是否为静态资源
 */
function isStaticAsset(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/static/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2')
  )
}

// 消息处理 - 与主线程通信
self.addEventListener('message', (event) => {
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ type: 'CACHE_STATS', payload: stats })
      })
      break
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' })
      })
      break
      
    default:
      console.log('[SW] Unknown message type:', type)
  }
})

/**
 * 获取缓存统计信息
 */
async function getCacheStats() {
  const cacheNames = await caches.keys()
  const stats = {}
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    stats[cacheName] = {
      entries: keys.length,
      size: await estimateCacheSize(cache)
    }
  }
  
  return stats
}

/**
 * 估算缓存大小
 */
async function estimateCacheSize(cache) {
  const keys = await cache.keys()
  let totalSize = 0
  
  for (const key of keys.slice(0, 10)) { // 只检查前10个条目以避免性能问题
    try {
      const response = await cache.match(key)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    } catch (error) {
      // 忽略错误
    }
  }
  
  // 估算总大小
  return Math.round((totalSize / Math.min(keys.length, 10)) * keys.length)
}

/**
 * 清空所有缓存
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  )
}

console.log('[SW] Service Worker loaded')