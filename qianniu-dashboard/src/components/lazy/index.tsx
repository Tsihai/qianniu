/**
 * 懒加载组件导出
 * 
 * @description 统一管理所有懒加载组件，优化代码分割和加载性能
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - 动态导入大型组件
 * - 统一的加载状态管理
 * - 错误边界集成
 * - 预加载策略
 */

import React, { lazy, ComponentType } from 'react'
import { SimpleErrorBoundary } from '@/components/error-boundary'
import { DelayedLoading, Loading } from '@/components/loading'

// 创建带错误边界的懒加载组件
function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn)
  
  return function WrappedLazyComponent(props: React.ComponentProps<T>) {
    return (
      <SimpleErrorBoundary message="组件加载失败，请刷新页面重试">
        <React.Suspense 
          fallback={
            fallback || 
            <DelayedLoading 
              fallback={<Loading variant="skeleton" />}
            >
              <Loading variant="spinner" />
            </DelayedLoading>
          }
        >
          <LazyComponent {...props} />
        </React.Suspense>
      </SimpleErrorBoundary>
    )
  }
}

// 懒加载的图表组件
export const LazyMetricsChart = createLazyComponent(
  () => import('@/components/charts/MetricsChart').then(module => ({ default: module.MetricsChart })),
  <div className="h-64 bg-muted animate-pulse rounded-lg" />
)

export const LazyConnectionQualityChart = createLazyComponent(
  () => import('@/components/charts/ConnectionQualityChart').then(module => ({ default: module.ConnectionQualityChart })),
  <div className="h-64 bg-muted animate-pulse rounded-lg" />
)

export const LazySystemHealthChart = createLazyComponent(
  () => import('@/components/charts/SystemHealthChart').then(module => ({ default: module.SystemHealthChart })),
  <div className="h-64 bg-muted animate-pulse rounded-lg" />
)

// 懒加载的监控组件
export const LazyPerformanceMetrics = createLazyComponent(
  () => import('@/components/monitoring/PerformanceMetrics').then(module => ({ default: module.PerformanceMetrics })),
  <div className="space-y-4">
    <div className="h-32 bg-muted animate-pulse rounded-lg" />
    <div className="h-32 bg-muted animate-pulse rounded-lg" />
  </div>
)

// 懒加载的WebSocket状态组件
export const LazyWebSocketStatus = createLazyComponent(
  () => import('@/components/websocket/WebSocketStatus').then(module => ({ default: module.WebSocketStatus })),
  <div className="h-48 bg-muted animate-pulse rounded-lg" />
)

// 预加载函数
export const preloadComponents = {
  charts: () => {
    import('@/components/charts/MetricsChart')
    import('@/components/charts/ConnectionQualityChart')
    import('@/components/charts/SystemHealthChart')
  },
  monitoring: () => {
    import('@/components/monitoring/PerformanceMetrics')
  },
  websocket: () => {
    import('@/components/websocket/WebSocketStatus')
  },
  all: () => {
    preloadComponents.charts()
    preloadComponents.monitoring()
    preloadComponents.websocket()
  }
}

// 智能预加载Hook
export function useSmartPreload() {
  React.useEffect(() => {
    // 在空闲时间预加载组件
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloadComponents.all()
      }, { timeout: 5000 })
    } else {
      // 降级方案：延迟预加载
      setTimeout(() => {
        preloadComponents.all()
      }, 2000)
    }
  }, [])
}

export default {
  LazyMetricsChart,
  LazyConnectionQualityChart,
  LazySystemHealthChart,
  LazyPerformanceMetrics,
  LazyWebSocketStatus,
  preloadComponents,
  useSmartPreload
}