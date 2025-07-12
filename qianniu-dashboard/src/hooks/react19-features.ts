/**
 * React 19 新特性集成
 * 
 * @description 集成React 19的新特性，包括useActionState、useOptimistic等
 * @author qianniu-dashboard
 * @created 2025-01-10
 * @version 1.0.0
 * 
 * 功能特性：
 * - useActionState 表单状态管理
 * - useOptimistic 乐观更新
 * - use Hook 数据获取
 * - 并发特性优化
 * - 错误边界集成
 */

import { useActionState, useOptimistic, use, useTransition, startTransition } from 'react'
import { useCallback, useMemo, useState } from 'react'

// 配置更新的Action类型
interface ConfigUpdateAction {
  type: 'UPDATE_CONFIG'
  payload: {
    key: string
    value: any
  }
}

interface ConfigState {
  threshold: number
  refreshInterval: number
  enableNotifications: boolean
  maxConnections: number
  pending: boolean
  error: string | null
}

// 配置更新的Action函数
async function updateConfigAction(
  prevState: ConfigState,
  formData: FormData
): Promise<ConfigState> {
  try {
    const threshold = Number(formData.get('threshold'))
    const refreshInterval = Number(formData.get('refreshInterval'))
    const enableNotifications = formData.get('enableNotifications') === 'on'
    const maxConnections = Number(formData.get('maxConnections'))

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 验证数据
    if (threshold < 0 || threshold > 100) {
      throw new Error('阈值必须在0-100之间')
    }

    if (refreshInterval < 1000 || refreshInterval > 60000) {
      throw new Error('刷新间隔必须在1-60秒之间')
    }

    return {
      threshold,
      refreshInterval,
      enableNotifications,
      maxConnections,
      pending: false,
      error: null
    }
  } catch (error) {
    return {
      ...prevState,
      pending: false,
      error: error instanceof Error ? error.message : '更新失败'
    }
  }
}

/**
 * 配置表单Hook - 使用useActionState
 */
export function useConfigForm(initialConfig: Omit<ConfigState, 'pending' | 'error'>) {
  const initialState: ConfigState = {
    ...initialConfig,
    pending: false,
    error: null
  }

  const [state, formAction, isPending] = useActionState(updateConfigAction, initialState)

  const resetError = useCallback(() => {
    // 在React 19中，可以通过重新设置状态来清除错误
    if (state.error) {
      // 创建一个空的FormData来重置状态
      const resetFormData = new FormData()
      resetFormData.set('threshold', state.threshold.toString())
      resetFormData.set('refreshInterval', state.refreshInterval.toString())
      resetFormData.set('enableNotifications', state.enableNotifications ? 'on' : 'off')
      resetFormData.set('maxConnections', state.maxConnections.toString())
      formAction(resetFormData)
    }
  }, [state, formAction])

  return {
    state,
    formAction,
    isPending,
    resetError,
    hasError: !!state.error
  }
}

// 指标数据类型
interface MetricData {
  id: string
  name: string
  value: number
  timestamp: number
  status: 'normal' | 'warning' | 'error'
}

/**
 * 乐观更新Hook - 用于实时指标显示
 */
export function useOptimisticMetrics(initialMetrics: MetricData[]) {
  const [optimisticMetrics, addOptimisticMetric] = useOptimistic(
    initialMetrics,
    (state, newMetric: MetricData) => {
      // 检查是否已存在相同ID的指标
      const existingIndex = state.findIndex(metric => metric.id === newMetric.id)
      
      if (existingIndex >= 0) {
        // 更新现有指标
        const newState = [...state]
        newState[existingIndex] = newMetric
        return newState
      } else {
        // 添加新指标
        return [...state, newMetric]
      }
    }
  )

  const updateMetric = useCallback((metric: MetricData) => {
    addOptimisticMetric(metric)
  }, [addOptimisticMetric])

  const updateMetricValue = useCallback((id: string, value: number) => {
    const existingMetric = optimisticMetrics.find(m => m.id === id)
    if (existingMetric) {
      const updatedMetric: MetricData = {
        ...existingMetric,
        value,
        timestamp: Date.now(),
        status: value > 80 ? 'error' : value > 60 ? 'warning' : 'normal'
      }
      addOptimisticMetric(updatedMetric)
    }
  }, [optimisticMetrics, addOptimisticMetric])

  return {
    metrics: optimisticMetrics,
    updateMetric,
    updateMetricValue
  }
}

/**
 * 数据获取Hook - 使用use Hook
 */
export function useAsyncData<T>(promise: Promise<T>) {
  try {
    const data = use(promise)
    return { data, error: null, loading: false }
  } catch (error) {
    if (error instanceof Promise) {
      // 仍在加载中
      return { data: null, error: null, loading: true }
    }
    // 实际错误
    return { data: null, error: error as Error, loading: false }
  }
}

/**
 * 并发更新Hook
 */
export function useConcurrentUpdates() {
  const [isPending, startTransitionFn] = useTransition()
  const [updates, setUpdates] = useState<string[]>([])

  const addUpdate = useCallback((updateId: string, updateFn: () => void) => {
    startTransitionFn(() => {
      setUpdates(prev => [...prev, updateId])
      updateFn()
      // 延迟移除更新标记
      setTimeout(() => {
        setUpdates(prev => prev.filter(id => id !== updateId))
      }, 1000)
    })
  }, [startTransitionFn])

  const batchUpdates = useCallback((updateFns: Array<() => void>) => {
    startTransition(() => {
      updateFns.forEach(fn => fn())
    })
  }, [])

  return {
    isPending,
    updates,
    addUpdate,
    batchUpdates
  }
}

/**
 * WebSocket连接状态的乐观更新
 */
interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastConnected: number | null
  reconnectAttempts: number
  latency: number
}

export function useOptimisticConnection(initialState: ConnectionState) {
  const [optimisticState, updateOptimisticState] = useOptimistic(
    initialState,
    (state, update: Partial<ConnectionState>) => ({
      ...state,
      ...update
    })
  )

  const connect = useCallback(() => {
    // 乐观地更新为连接中状态
    updateOptimisticState({ 
      status: 'connecting',
      reconnectAttempts: optimisticState.reconnectAttempts + 1
    })
  }, [updateOptimisticState, optimisticState.reconnectAttempts])

  const connected = useCallback((latency: number) => {
    updateOptimisticState({
      status: 'connected',
      lastConnected: Date.now(),
      latency,
      reconnectAttempts: 0
    })
  }, [updateOptimisticState])

  const disconnect = useCallback(() => {
    updateOptimisticState({
      status: 'disconnected',
      latency: 0
    })
  }, [updateOptimisticState])

  const error = useCallback(() => {
    updateOptimisticState({
      status: 'error',
      latency: 0
    })
  }, [updateOptimisticState])

  return {
    state: optimisticState,
    connect,
    connected,
    disconnect,
    error
  }
}

/**
 * 表单提交Hook - 结合useActionState和useOptimistic
 */
export function useFormSubmission<T>(
  submitAction: (prevState: any, formData: FormData) => Promise<any>,
  initialState: any,
  optimisticUpdate?: (current: T[], formData: FormData) => T[]
) {
  const [state, formAction, isPending] = useActionState(submitAction, initialState)
  const [items, setItems] = useState<T[]>([])
  
  const [optimisticItems, addOptimisticItem] = useOptimistic(
    items,
    (currentItems, formData: FormData) => {
      if (optimisticUpdate) {
        return optimisticUpdate(currentItems, formData)
      }
      return currentItems
    }
  )

  const submitWithOptimistic = useCallback((formData: FormData) => {
    if (optimisticUpdate) {
      addOptimisticItem(formData)
    }
    // 直接调用formAction，它会自动传递formData
    formAction(new FormData())
  }, [formAction, addOptimisticItem, optimisticUpdate])

  return {
    state,
    items: optimisticItems,
    setItems,
    submitWithOptimistic,
    formAction,
    isPending
  }
}

/**
 * 性能监控Hook - 使用React 19的并发特性
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    updateCount: 0,
    memoryUsage: 0
  })
  
  const [isPending, startTransitionFn] = useTransition()

  const recordMetric = useCallback((metricName: keyof typeof metrics, value: number) => {
    startTransitionFn(() => {
      setMetrics(prev => ({
        ...prev,
        [metricName]: value,
        updateCount: prev.updateCount + 1
      }))
    })
  }, [startTransitionFn])

  const batchRecordMetrics = useCallback((newMetrics: Partial<typeof metrics>) => {
    startTransitionFn(() => {
      setMetrics(prev => ({
        ...prev,
        ...newMetrics,
        updateCount: prev.updateCount + 1
      }))
    })
  }, [startTransitionFn])

  return {
    metrics,
    recordMetric,
    batchRecordMetrics,
    isPending
  }
}

export default {
  useConfigForm,
  useOptimisticMetrics,
  useAsyncData,
  useConcurrentUpdates,
  useOptimisticConnection,
  useFormSubmission,
  usePerformanceMonitoring
}