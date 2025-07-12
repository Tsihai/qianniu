import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore, useTransition } from 'react';
import { useRealTimeData } from './useRealTimeData';
import { useLocalStorage } from './useLocalStorage';
import { SlidingWindow } from '../lib/slidingWindow';
import { 
  MetricsCalculatorFactory, 
  BaseMetricsCalculator,
  MetricResult
} from '../lib/metricsCalculators';
import { METRICS_TYPE } from '../lib/constants';
import { ExternalStore, createExternalStore, type StoreState } from '../lib/externalStore';
import { getGlobalCache } from '../lib/dataCache';

// 定义指标类型
type MetricType = typeof METRICS_TYPE[keyof typeof METRICS_TYPE];

// 配置接口
export interface UseRealTimeMetricsOptions {
  /** 计算间隔（毫秒） */
  calculationInterval?: number;
  /** 滑动窗口大小（毫秒） */
  windowSize?: number;
  /** 启用的指标类型 */
  enabledMetrics?: MetricType[];
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 是否启用自动清理 */
  enableAutoCleanup?: boolean;
  /** 清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 最大数据点数量 */
  maxDataPoints?: number;
  // React 19 优化选项
  /** 是否使用 useTransition */
  useTransition?: boolean;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存TTL（毫秒） */
  cacheTTL?: number;
  /** 是否启用离线恢复 */
  enableOfflineRecovery?: boolean;
  /** 存储键名 */
  storeKey?: string;
}

// 指标数据状态
export interface MetricsState {
  /** 消息处理速率 */
  messageRate: MetricResult | null;
  /** 平均响应时间 */
  responseTime: MetricResult | null;
  /** 错误率 */
  errorRate: MetricResult | null;
  /** 连接稳定性 */
  connectionStability: MetricResult | null;
  /** 客服工作负载 */
  agentWorkload: MetricResult | null;
  /** 系统性能 */
  systemPerformance: MetricResult | null;
  /** 最后更新时间 */
  lastUpdated: number;
  /** 是否正在计算 */
  isCalculating: boolean;
}

// 错误状态
export interface MetricsError {
  type: 'calculation' | 'data' | 'memory' | 'unknown';
  message: string;
  timestamp: number;
  metric?: MetricType;
}

// Hook返回值
export interface UseRealTimeMetricsReturn {
  /** 指标数据 */
  metrics: MetricsState;
  /** 错误信息 */
  error: MetricsError | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否有待处理的状态变更 */
  isPending: boolean;
  /** 更新配置 */
  updateConfig: (config: Partial<UseRealTimeMetricsOptions>) => void;
  /** 重置数据 */
  resetMetrics: () => void;
  /** 手动刷新 */
  refreshMetrics: () => Promise<void>;
  /** 清理资源 */
  cleanup: () => void;
  /** 获取指标历史 */
  getMetricHistory: (metric: MetricType, timeRange?: number) => MetricResult[];
  /** 清理缓存 */
  clearCache: () => Promise<void>;
  /** 获取缓存信息 */
  getCacheInfo: () => Promise<{ size: number; lastUpdated: number | null }>;
}

// 默认配置
const DEFAULT_CONFIG: Required<UseRealTimeMetricsOptions> = {
  calculationInterval: 5000, // 5秒
  windowSize: 300000, // 5分钟
  enabledMetrics: [
    METRICS_TYPE.MESSAGE_RATE, 
    METRICS_TYPE.RESPONSE_TIME, 
    METRICS_TYPE.ERROR_RATE, 
    METRICS_TYPE.CONNECTION_STABILITY, 
    METRICS_TYPE.AGENT_WORKLOAD, 
    METRICS_TYPE.SYSTEM_PERFORMANCE
  ],
  enablePersistence: true,
  enableAutoCleanup: true,
  cleanupInterval: 60000, // 1分钟
  maxDataPoints: 1000,
  // React 19 优化默认值
  useTransition: true,
  enableCache: true,
  cacheTTL: 300000, // 5分钟
  enableOfflineRecovery: true,
  storeKey: 'metrics-store'
};

// 初始指标状态
const INITIAL_METRICS_STATE: MetricsState = {
  messageRate: null,
  responseTime: null,
  errorRate: null,
  connectionStability: null,
  agentWorkload: null,
  systemPerformance: null,
  lastUpdated: 0,
  isCalculating: false
};

/**
 * 实时指标管理Hook
 * 集成数据获取、指标计算、状态管理和配置管理
 */
export function useRealTimeMetrics(
  options: UseRealTimeMetricsOptions = {}
): UseRealTimeMetricsReturn {
  // 合并配置
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...options }), [options]);
  
  // React 19 优化：使用 useTransition
  const [isPending, startTransition] = useTransition();
  
  // 创建外部存储
  const metricsStore = useMemo(() => {
    return createExternalStore(
      INITIAL_METRICS_STATE,
      {
        cacheKey: config.storeKey,
        enableCache: config.enableCache,
        cacheTTL: config.cacheTTL,
        enableOfflineRecovery: config.enableOfflineRecovery,
        cacheStore: 'METRICS_DATA'
      }
    );
  }, [config.storeKey, config.enableCache, config.cacheTTL, config.enableOfflineRecovery]);
  
  // 使用 useSyncExternalStore 订阅状态变化
  const metricsState = useSyncExternalStore(
    metricsStore.subscribe,
    metricsStore.getSnapshot,
    () => ({
      data: INITIAL_METRICS_STATE,
      loading: false,
      error: null,
      lastUpdated: Date.now(),
      version: 1
    }) // SSR fallback
  );
  
  const metrics = metricsState.data;
  
  // 状态管理
  const [error, setError] = useState<MetricsError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentConfig, setCurrentConfig] = useState(config);
  
  // 缓存管理
  const cache = useMemo(() => getGlobalCache(), []);
  
  // 引用管理
  const slidingWindowRef = useRef<SlidingWindow | null>(null);
  const calculatorFactoryRef = useRef<MetricsCalculatorFactory | null>(null);
  const calculationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsHistoryRef = useRef<Map<MetricType, MetricResult[]>>(new Map());
  const isCalculatingRef = useRef(false);
  
  // 获取实时数据
  const { data } = useRealTimeData();
  const { messages, agents, systemStats } = data;
  const isConnected = data.isConnected;
  
  // 持久化存储
  const [persistedMetrics, setPersistedMetrics] = useLocalStorage<MetricsState>(
    'realtime-metrics',
    INITIAL_METRICS_STATE
  );
  
  // 初始化滑动窗口和计算器工厂
  useEffect(() => {
    const initializeAsync = async () => {
      try {
        if (!slidingWindowRef.current) {
          slidingWindowRef.current = new SlidingWindow({
            windowSize: currentConfig.windowSize,
            maxDataPoints: currentConfig.maxDataPoints
          });
        }
        
        if (!calculatorFactoryRef.current) {
          calculatorFactoryRef.current = new MetricsCalculatorFactory();
        }
        
        // 如果启用持久化且有存储的数据，则恢复状态
        if (currentConfig.enablePersistence && persistedMetrics.lastUpdated > 0) {
          await metricsStore.setData(persistedMetrics);
        }
        
        setIsLoading(false);
      } catch (err) {
        handleError('unknown', '初始化失败', err);
        setIsLoading(false);
      }
    };
    
    initializeAsync();
  }, [currentConfig.windowSize, currentConfig.maxDataPoints, currentConfig.enablePersistence, persistedMetrics]);
  
  // 错误处理函数
  const handleError = useCallback((type: MetricsError['type'], message: string, originalError?: unknown, metric?: MetricType) => {
    const errorMessage = originalError 
      ? `: ${(originalError as Error)?.message || String(originalError)}`
      : '';
    
    const errorObj: MetricsError = {
      type,
      message: `${message}${errorMessage}`,
      timestamp: Date.now(),
      metric
    };
    
    setError(errorObj);
    console.error('[useRealTimeMetrics]', errorObj, originalError);
  }, []);
  
  // 数据验证函数
  const validateData = useCallback((data: any, dataType: string): boolean => {
    if (!data) {
      handleError('data', `${dataType}数据为空`);
      return false;
    }
    
    if (Array.isArray(data) && data.length === 0) {
      // 空数组是有效的，不算错误
      return true;
    }
    
    return true;
  }, [handleError]);
  
  // 计算单个指标
  const calculateMetric = useCallback(async (metricType: MetricType): Promise<MetricResult | null> => {
    try {
      if (!calculatorFactoryRef.current || !slidingWindowRef.current) {
        throw new Error('计算器或滑动窗口未初始化');
      }
      
      const calculator = calculatorFactoryRef.current.getCalculator(metricType);
      if (!calculator) {
        throw new Error(`未找到${metricType}计算器`);
      }
      
      // 根据指标类型准备数据
      let data: any;
      switch (metricType) {
        case METRICS_TYPE.MESSAGE_RATE:
        case METRICS_TYPE.MESSAGE_PROCESSING_RATE:
          data = messages;
          break;
        case METRICS_TYPE.RESPONSE_TIME:
        case METRICS_TYPE.AVERAGE_RESPONSE_TIME:
          data = messages.filter(msg => msg.responseTime !== undefined);
          break;
        case METRICS_TYPE.ERROR_RATE:
          data = messages;
          break;
        case METRICS_TYPE.CONNECTION_STABILITY:
          data = { isConnected };
          break;
        case METRICS_TYPE.AGENT_WORKLOAD:
          data = agents;
          break;
        case METRICS_TYPE.SYSTEM_PERFORMANCE:
          data = systemStats;
          break;
        default:
          throw new Error(`未知指标类型: ${metricType}`);
      }
      
      if (!validateData(data, metricType)) {
        return null;
      }
      
      // 添加数据到滑动窗口
      slidingWindowRef.current.addDataPoint({
        timestamp: Date.now(),
        value: data,
        metadata: { metricType }
      });
      
      // 获取窗口数据并计算
      const windowData = slidingWindowRef.current.getDataPoints();
      const result = calculator.calculate();
      
      // 存储历史记录
      if (!metricsHistoryRef.current.has(metricType)) {
        metricsHistoryRef.current.set(metricType, []);
      }
      const history = metricsHistoryRef.current.get(metricType)!;
      history.push(result);
      
      // 限制历史记录长度
      if (history.length > currentConfig.maxDataPoints) {
        history.splice(0, history.length - currentConfig.maxDataPoints);
      }
      
      return result;
    } catch (err) {
      handleError('calculation', `计算${metricType}指标失败`, err, metricType);
      return null;
    }
  }, [messages, agents, systemStats, isConnected, currentConfig.maxDataPoints, validateData, handleError]);
  
  // 计算所有启用的指标
  const calculateAllMetrics = useCallback(async (): Promise<void> => {
    if (isCalculatingRef.current) {
      return; // 防止重复计算
    }
    
    isCalculatingRef.current = true;
    
    // 使用 startTransition 优化状态更新
    const updateCalculatingState = (isCalculating: boolean) => {
      const updateFn = async () => {
        const currentData = metricsStore.getState().data;
        await metricsStore.setData({ ...currentData, isCalculating });
      };
      
      if (currentConfig.useTransition) {
        startTransition(updateFn);
      } else {
        updateFn();
      }
    };
    
    updateCalculatingState(true);
    
    try {
      const results: Partial<MetricsState> = {};
      
      // 并行计算所有启用的指标
      const calculations = currentConfig.enabledMetrics.map(async (metricType) => {
        const result = await calculateMetric(metricType);
        if (result) {
          // 映射指标类型到MetricsState属性名
          let propertyName: keyof MetricsState;
          switch (metricType) {
            case METRICS_TYPE.MESSAGE_RATE:
            case METRICS_TYPE.MESSAGE_PROCESSING_RATE:
              propertyName = 'messageRate';
              break;
            case METRICS_TYPE.RESPONSE_TIME:
            case METRICS_TYPE.AVERAGE_RESPONSE_TIME:
              propertyName = 'responseTime';
              break;
            case METRICS_TYPE.ERROR_RATE:
              propertyName = 'errorRate';
              break;
            case METRICS_TYPE.CONNECTION_STABILITY:
              propertyName = 'connectionStability';
              break;
            case METRICS_TYPE.AGENT_WORKLOAD:
              propertyName = 'agentWorkload';
              break;
            case METRICS_TYPE.SYSTEM_PERFORMANCE:
              propertyName = 'systemPerformance';
              break;
            default:
              return;
          }
          results[propertyName] = result as any;
        }
      });
      
      await Promise.all(calculations);
      
      // 更新状态
      const newMetrics: MetricsState = {
        ...INITIAL_METRICS_STATE,
        ...results,
        lastUpdated: Date.now(),
        isCalculating: false
      };
      
      // 使用 startTransition 优化状态更新
      if (currentConfig.useTransition) {
          startTransition(async () => {
            await metricsStore.setData(newMetrics);
          });
        } else {
          await metricsStore.setData(newMetrics);
        }
      
      // 持久化存储
      if (currentConfig.enablePersistence) {
        setPersistedMetrics(newMetrics);
      }
      
      // 清除错误状态
      setError(null);
    } catch (err) {
      handleError('calculation', '批量计算指标失败', err);
    } finally {
      isCalculatingRef.current = false;
      updateCalculatingState(false);
    }
  }, [currentConfig.enabledMetrics, currentConfig.enablePersistence, currentConfig.useTransition, calculateMetric, setPersistedMetrics, handleError, metricsStore, startTransition]);
  
  // 设置计算定时器
  useEffect(() => {
    if (calculationTimerRef.current) {
      clearInterval(calculationTimerRef.current);
    }
    
    // 立即执行一次计算
    calculateAllMetrics();
    
    // 设置定时计算
    calculationTimerRef.current = setInterval(
      calculateAllMetrics,
      currentConfig.calculationInterval
    );
    
    return () => {
      if (calculationTimerRef.current) {
        clearInterval(calculationTimerRef.current);
        calculationTimerRef.current = null;
      }
    };
  }, [calculateAllMetrics, currentConfig.calculationInterval]);
  
  // 自动清理定时器
  useEffect(() => {
    if (!currentConfig.enableAutoCleanup) {
      return;
    }
    
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
    }
    
    cleanupTimerRef.current = setInterval(() => {
      try {
        // 清理滑动窗口中的过期数据
        if (slidingWindowRef.current) {
          // 滑动窗口会自动清理过期数据
        }
        
        // 清理指标历史记录
        const cutoffTime = Date.now() - currentConfig.windowSize * 2; // 保留窗口大小的2倍时间
        metricsHistoryRef.current.forEach((history, metricType) => {
          const filteredHistory = history.filter(result => result.timestamp > cutoffTime);
          metricsHistoryRef.current.set(metricType, filteredHistory);
        });
      } catch (err) {
        handleError('memory', '自动清理失败', err);
      }
    }, currentConfig.cleanupInterval);
    
    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, [currentConfig.enableAutoCleanup, currentConfig.cleanupInterval, currentConfig.windowSize, handleError]);
  
  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<UseRealTimeMetricsOptions>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
    
    // 如果窗口大小改变，重新初始化滑动窗口
    if (newConfig.windowSize && newConfig.windowSize !== currentConfig.windowSize) {
      if (slidingWindowRef.current) {
        slidingWindowRef.current = new SlidingWindow({
          windowSize: newConfig.windowSize,
          maxDataPoints: newConfig.maxDataPoints || currentConfig.maxDataPoints
        });
      }
    }
  }, [currentConfig.windowSize, currentConfig.maxDataPoints]);
  
  // 重置指标数据
  const resetMetrics = useCallback(async () => {
    await metricsStore.setData(INITIAL_METRICS_STATE);
    setError(null);
    
    // 清理滑动窗口
    if (slidingWindowRef.current) {
      slidingWindowRef.current.clear();
    }
    
    // 清理历史记录
    metricsHistoryRef.current.clear();
    
    // 清理持久化数据
    if (currentConfig.enablePersistence) {
      setPersistedMetrics(INITIAL_METRICS_STATE);
    }
  }, [currentConfig.enablePersistence, setPersistedMetrics, metricsStore]);
  
  // 手动刷新指标
  const refreshMetrics = useCallback(async (): Promise<void> => {
    setError(null);
    await calculateAllMetrics();
  }, [calculateAllMetrics]);
  
  // 清理资源
  const cleanup = useCallback(() => {
    // 清理定时器
    if (calculationTimerRef.current) {
      clearInterval(calculationTimerRef.current);
      calculationTimerRef.current = null;
    }
    
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    
    // 清理引用
    slidingWindowRef.current = null;
    calculatorFactoryRef.current = null;
    metricsHistoryRef.current.clear();
    isCalculatingRef.current = false;
  }, []);
  
  // 获取指标历史
  const getMetricHistory = useCallback((metricType: MetricType, timeRange?: number): MetricResult[] => {
    const history = metricsHistoryRef.current.get(metricType) || [];
    
    if (!timeRange) {
      return history;
    }
    
    const cutoffTime = Date.now() - timeRange;
    return history.filter(result => result.timestamp > cutoffTime);
  }, []);
  
  // 清理缓存
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await cache.clear('METRICS_DATA');
      await metricsStore.clearCache();
    } catch (err) {
      handleError('unknown', '清理缓存失败', err);
    }
  }, [cache, metricsStore, handleError]);
  
  // 获取缓存信息
  const getCacheInfo = useCallback(async (): Promise<{ size: number; lastUpdated: number | null }> => {
    try {
      const storeInfo = await metricsStore.getCacheInfo();
      return {
        size: storeInfo ? 1 : 0, // 简化：如果有缓存数据则为1，否则为0
        lastUpdated: storeInfo?.data?.lastUpdated || null
      };
    } catch (err) {
      handleError('unknown', '获取缓存信息失败', err);
      return { size: 0, lastUpdated: null };
    }
  }, [metricsStore, handleError]);
  
  // 离线恢复
  useEffect(() => {
    if (!currentConfig.enableOfflineRecovery) {
      return;
    }
    
    const recoverFromCache = async () => {
      try {
        const cachedInfo = await metricsStore.getCacheInfo();
        if (cachedInfo && cachedInfo.data) {
          // 验证缓存数据的有效性
          const isValid = cachedInfo.data.lastUpdated && 
            (Date.now() - cachedInfo.data.lastUpdated) < currentConfig.cacheTTL;
          
          if (isValid) {
            if (currentConfig.useTransition) {
              startTransition(async () => {
                await metricsStore.setData(cachedInfo.data.data);
              });
            } else {
              await metricsStore.setData(cachedInfo.data.data);
            }
          }
        }
      } catch (err) {
        handleError('unknown', '离线恢复失败', err);
      }
    };
    
    recoverFromCache();
  }, [currentConfig.enableOfflineRecovery, currentConfig.cacheTTL, currentConfig.useTransition, metricsStore, startTransition, handleError]);
  
  // 组件卸载时清理资源
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    metrics,
    error,
    isLoading,
    isPending,
    updateConfig,
    resetMetrics,
    refreshMetrics,
    cleanup,
    getMetricHistory,
    clearCache,
    getCacheInfo
  };
}

// 导出类型
export type {
  MetricResult,
  BaseMetricsCalculator
} from '../lib/metricsCalculators';

export type { MetricType };