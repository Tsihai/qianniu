'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PerformanceMetrics,
  PerformanceMonitoringConfig,
  PerformanceTrend,
  PerformanceAlert,
  PerformanceStats,
  ReactProfilerData,
  UsePerformanceMetricsReturn,
  PerformanceThresholds,
  PerformanceMonitoringEvents,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_PERFORMANCE_THRESHOLDS,
} from '@/types/monitoring';

/**
 * 性能监控Hook
 * 提供实时性能指标监控、趋势分析和警告功能
 * 
 * @param initialConfig - 性能监控配置选项
 * @param initialConfig.sampleInterval - 采样间隔（毫秒），默认1000ms
 * @param initialConfig.maxDataPoints - 最大数据点数量，默认100
 * @param initialConfig.enableCpuMonitoring - 是否启用CPU监控，默认true
 * @param initialConfig.enableMemoryMonitoring - 是否启用内存监控，默认true
 * @param initialConfig.enableApiMonitoring - 是否启用API监控，默认true
 * @param initialConfig.enableErrorMonitoring - 是否启用错误监控，默认true
 * @param initialConfig.enableFpsMonitoring - 是否启用FPS监控，默认false
 * 
 * @param thresholds - 性能阈值配置
 * @param thresholds.cpu - CPU使用率阈值配置
 * @param thresholds.memory - 内存使用量阈值配置
 * @param thresholds.apiResponseTime - API响应时间阈值配置
 * @param thresholds.errorRate - 错误率阈值配置
 * @param thresholds.fps - 帧率阈值配置
 * 
 * @param events - 事件回调函数
 * @param events.onMetricsUpdate - 指标更新时的回调
 * @param events.onAlert - 产生警告时的回调
 * @param events.onThresholdExceeded - 阈值超出时的回调
 * @param events.onMonitoringStart - 监控开始时的回调
 * @param events.onMonitoringStop - 监控停止时的回调
 * @param events.onError - 发生错误时的回调
 * 
 * @returns 性能监控相关的状态和方法
 * 
 * @example
 * ```tsx
 * const {
 *   currentMetrics,
 *   isMonitoring,
 *   startMonitoring,
 *   stopMonitoring,
 *   alerts
 * } = usePerformanceMetrics({
 *   sampleInterval: 2000,
 *   enableFpsMonitoring: true
 * }, {
 *   cpu: { warning: 70, critical: 90 }
 * }, {
 *   onAlert: (alert) => console.log('Performance alert:', alert)
 * });
 * 
 * // 开始监控
 * useEffect(() => {
 *   startMonitoring();
 *   return () => stopMonitoring();
 * }, []);
 * ```
 */
export function usePerformanceMetrics(
  initialConfig: Partial<PerformanceMonitoringConfig> = {},
  thresholds: Partial<PerformanceThresholds> = {},
  events: Partial<PerformanceMonitoringEvents> = {}
): UsePerformanceMetricsReturn {
  // 配置状态
  const [config, setConfig] = useState<PerformanceMonitoringConfig>({
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...initialConfig,
  });

  const [performanceThresholds] = useState<PerformanceThresholds>({
    ...DEFAULT_PERFORMANCE_THRESHOLDS,
    ...thresholds,
  });

  // 监控状态
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [profilerData, setProfilerData] = useState<ReactProfilerData[]>([]);
  const [stats, setStats] = useState<PerformanceStats>({
    totalSamples: 0,
    startTime: 0,
    uptime: 0,
    alertCount: { info: 0, warning: 0, critical: 0 },
    averageMetrics: {
      cpu: 0,
      memory: 0,
      apiResponseTime: 0,
      errorRate: 0,
      fps: 0,
      pageLoadTime: 0,
      domNodes: 0,
      jsHeapSize: 0,
    },
    lastUpdated: 0,
  });

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const apiCallsRef = useRef<{ start: number; success: number; error: number }>({ start: 0, success: 0, error: 0 });
  const fpsRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: 0 });
  const performanceObserverRef = useRef<PerformanceObserver | null>(null);

  /**
   * 获取当前JavaScript堆内存使用量
   * 
   * @returns 内存使用量（MB），如果不支持则返回0
   * 
   * @example
   * ```typescript
   * const memoryUsage = getMemoryInfo(); // 返回: 45 (MB)
   * ```
   */
  const getMemoryInfo = useCallback((): number => {
    if ('memory' in performance && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024); // 转换为MB
    }
    return 0;
  }, []);

  /**
   * 获取CPU使用率（模拟实现）
   * 
   * 通过执行固定数量的计算操作并测量执行时间来模拟CPU使用率
   * 注意：这是一个近似值，实际的CPU使用率需要系统级API
   * 
   * @returns CPU使用率百分比（0-100）
   * 
   * @example
   * ```typescript
   * const cpuUsage = getCpuUsage(); // 返回: 65 (表示65%的CPU使用率)
   * ```
   */
  const getCpuUsage = useCallback((): number => {
    // 使用性能时间戳来模拟CPU使用率
    const start = performance.now();
    let iterations = 0;
    const maxIterations = 100000;
    
    while (iterations < maxIterations) {
      Math.random();
      iterations++;
    }
    
    const duration = performance.now() - start;
    // 将执行时间映射到CPU使用率（0-100）
    return Math.min(Math.round((duration / 10) * 100), 100);
  }, []);

  // 获取FPS
  const getFPS = useCallback((): number => {
    const now = performance.now();
    if (fpsRef.current.lastTime === 0) {
      fpsRef.current.lastTime = now;
      return 60; // 默认值
    }
    
    fpsRef.current.frames++;
    const delta = now - fpsRef.current.lastTime;
    
    if (delta >= 1000) { // 每秒计算一次
      const fps = Math.round((fpsRef.current.frames * 1000) / delta);
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
      return fps;
    }
    
    return 60; // 默认值
  }, []);

  // 获取DOM节点数量
  const getDomNodes = useCallback((): number => {
    return document.querySelectorAll('*').length;
  }, []);

  // 获取页面加载时间
  const getPageLoadTime = useCallback((): number => {
    if ('navigation' in performance && performance.navigation) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return Math.round(navigation.loadEventEnd - navigation.fetchStart);
    }
    return 0;
  }, []);

  // 获取API响应时间
  const getApiResponseTime = useCallback((): number => {
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const apiCalls = resourceEntries.filter(entry => 
      entry.name.includes('/api/') || 
      entry.name.includes('fetch') ||
      entry.name.includes('xhr')
    );
    
    if (apiCalls.length === 0) return 0;
    
    const totalTime = apiCalls.reduce((sum, entry) => sum + entry.duration, 0);
    return Math.round(totalTime / apiCalls.length);
  }, []);

  // 获取错误率
  const getErrorRate = useCallback((): number => {
    const { start, error } = apiCallsRef.current;
    if (start === 0) return 0;
    return Math.round((error / start) * 100);
  }, []);

  /**
   * 收集当前的性能指标
   * 
   * 根据配置收集各种性能指标，包括CPU、内存、API响应时间、错误率等
   * 
   * @returns 包含所有启用指标的性能数据对象
   * 
   * @example
   * ```typescript
   * const metrics = collectMetrics();
   * console.log(metrics);
   * // 输出: {
   * //   cpu: 45,
   * //   memory: 128,
   * //   apiResponseTime: 250,
   * //   errorRate: 2,
   * //   timestamp: 1640995200000,
   * //   fps: 60,
   * //   pageLoadTime: 1200,
   * //   domNodes: 1500,
   * //   jsHeapSize: 128
   * // }
   * ```
   */
  const collectMetrics = useCallback((): PerformanceMetrics => {
    const timestamp = Date.now();
    
    const metrics: PerformanceMetrics = {
      cpu: config.enableCpuMonitoring ? getCpuUsage() : 0,
      memory: config.enableMemoryMonitoring ? getMemoryInfo() : 0,
      apiResponseTime: config.enableApiMonitoring ? getApiResponseTime() : 0,
      errorRate: config.enableErrorMonitoring ? getErrorRate() : 0,
      timestamp,
    };

    if (config.enableFpsMonitoring) {
      metrics.fps = getFPS();
    }

    metrics.pageLoadTime = getPageLoadTime();
    metrics.domNodes = getDomNodes();
    metrics.jsHeapSize = getMemoryInfo();

    return metrics;
  }, [config, getCpuUsage, getMemoryInfo, getApiResponseTime, getErrorRate, getFPS, getPageLoadTime, getDomNodes]);

  // 检查阈值并生成警告
  const checkThresholds = useCallback((metrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    // 检查CPU
    if (metrics.cpu > performanceThresholds.cpu.critical) {
      newAlerts.push({
        id: `cpu-critical-${Date.now()}`,
        type: 'cpu',
        level: 'critical',
        message: `CPU使用率过高: ${metrics.cpu}%`,
        currentValue: metrics.cpu,
        threshold: performanceThresholds.cpu.critical,
        timestamp: metrics.timestamp,
        read: false,
      });
    } else if (metrics.cpu > performanceThresholds.cpu.warning) {
      newAlerts.push({
        id: `cpu-warning-${Date.now()}`,
        type: 'cpu',
        level: 'warning',
        message: `CPU使用率较高: ${metrics.cpu}%`,
        currentValue: metrics.cpu,
        threshold: performanceThresholds.cpu.warning,
        timestamp: metrics.timestamp,
        read: false,
      });
    }

    // 检查内存
    if (metrics.memory > performanceThresholds.memory.critical) {
      newAlerts.push({
        id: `memory-critical-${Date.now()}`,
        type: 'memory',
        level: 'critical',
        message: `内存使用量过高: ${metrics.memory}MB`,
        currentValue: metrics.memory,
        threshold: performanceThresholds.memory.critical,
        timestamp: metrics.timestamp,
        read: false,
      });
    } else if (metrics.memory > performanceThresholds.memory.warning) {
      newAlerts.push({
        id: `memory-warning-${Date.now()}`,
        type: 'memory',
        level: 'warning',
        message: `内存使用量较高: ${metrics.memory}MB`,
        currentValue: metrics.memory,
        threshold: performanceThresholds.memory.warning,
        timestamp: metrics.timestamp,
        read: false,
      });
    }

    // 检查API响应时间
    if (metrics.apiResponseTime > performanceThresholds.apiResponseTime.critical) {
      newAlerts.push({
        id: `api-critical-${Date.now()}`,
        type: 'api',
        level: 'critical',
        message: `API响应时间过长: ${metrics.apiResponseTime}ms`,
        currentValue: metrics.apiResponseTime,
        threshold: performanceThresholds.apiResponseTime.critical,
        timestamp: metrics.timestamp,
        read: false,
      });
    } else if (metrics.apiResponseTime > performanceThresholds.apiResponseTime.warning) {
      newAlerts.push({
        id: `api-warning-${Date.now()}`,
        type: 'api',
        level: 'warning',
        message: `API响应时间较长: ${metrics.apiResponseTime}ms`,
        currentValue: metrics.apiResponseTime,
        threshold: performanceThresholds.apiResponseTime.warning,
        timestamp: metrics.timestamp,
        read: false,
      });
    }

    // 检查错误率
    if (metrics.errorRate > performanceThresholds.errorRate.critical) {
      newAlerts.push({
        id: `error-critical-${Date.now()}`,
        type: 'error',
        level: 'critical',
        message: `错误率过高: ${metrics.errorRate}%`,
        currentValue: metrics.errorRate,
        threshold: performanceThresholds.errorRate.critical,
        timestamp: metrics.timestamp,
        read: false,
      });
    } else if (metrics.errorRate > performanceThresholds.errorRate.warning) {
      newAlerts.push({
        id: `error-warning-${Date.now()}`,
        type: 'error',
        level: 'warning',
        message: `错误率较高: ${metrics.errorRate}%`,
        currentValue: metrics.errorRate,
        threshold: performanceThresholds.errorRate.warning,
        timestamp: metrics.timestamp,
        read: false,
      });
    }

    // 检查FPS
    if (metrics.fps && metrics.fps < performanceThresholds.fps.critical) {
      newAlerts.push({
        id: `fps-critical-${Date.now()}`,
        type: 'fps',
        level: 'critical',
        message: `帧率过低: ${metrics.fps}FPS`,
        currentValue: metrics.fps,
        threshold: performanceThresholds.fps.critical,
        timestamp: metrics.timestamp,
        read: false,
      });
    } else if (metrics.fps && metrics.fps < performanceThresholds.fps.warning) {
      newAlerts.push({
        id: `fps-warning-${Date.now()}`,
        type: 'fps',
        level: 'warning',
        message: `帧率较低: ${metrics.fps}FPS`,
        currentValue: metrics.fps,
        threshold: performanceThresholds.fps.warning,
        timestamp: metrics.timestamp,
        read: false,
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
      newAlerts.forEach(alert => {
        events.onAlert?.(alert);
        events.onThresholdExceeded?.(alert.type as keyof PerformanceMetrics, alert.currentValue, alert.threshold);
      });
    }
  }, [performanceThresholds, events]);

  // 计算趋势
  const calculateTrends = useCallback((history: PerformanceMetrics[]): PerformanceTrend[] => {
    if (history.length < 2) return [];

    const metrics: (keyof PerformanceMetrics)[] = ['cpu', 'memory', 'apiResponseTime', 'errorRate'];
    
    return metrics.map(metric => {
      const data = history.map(h => {
        const value = h[metric];
        return {
          timestamp: h.timestamp,
          value: typeof value === 'number' ? value : 0,
        };
      }).filter(d => d.value !== undefined);

      if (data.length === 0) {
        return {
          metric,
          data: [],
          average: 0,
          min: 0,
          max: 0,
          trend: 'stable' as const,
        };
      }

      const values = data.map(d => d.value);
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // 计算趋势
      const recentValues = values.slice(-5); // 最近5个值
      const earlierValues = values.slice(-10, -5); // 之前5个值
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recentValues.length > 0 && earlierValues.length > 0) {
        const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const earlierAvg = earlierValues.reduce((sum, val) => sum + val, 0) / earlierValues.length;
        
        if (recentAvg > earlierAvg * 1.1) trend = 'up';
        else if (recentAvg < earlierAvg * 0.9) trend = 'down';
      }

      return {
        metric,
        data,
        average,
        min,
        max,
        trend,
      };
    });
  }, []);

  // 更新统计信息
  const updateStats = useCallback((newMetrics: PerformanceMetrics, history: PerformanceMetrics[]) => {
    const now = Date.now();
    const uptime = startTimeRef.current ? now - startTimeRef.current : 0;
    
    // 计算平均值
    const averageMetrics = history.length > 0 ? {
      cpu: history.reduce((sum, m) => sum + m.cpu, 0) / history.length,
      memory: history.reduce((sum, m) => sum + m.memory, 0) / history.length,
      apiResponseTime: history.reduce((sum, m) => sum + m.apiResponseTime, 0) / history.length,
      errorRate: history.reduce((sum, m) => sum + m.errorRate, 0) / history.length,
      fps: history.reduce((sum, m) => sum + (typeof m.fps === 'number' ? m.fps : 0), 0) / history.length,
      pageLoadTime: history.reduce((sum, m) => sum + (typeof m.pageLoadTime === 'number' ? m.pageLoadTime : 0), 0) / history.length,
      domNodes: history.reduce((sum, m) => sum + (typeof m.domNodes === 'number' ? m.domNodes : 0), 0) / history.length,
      jsHeapSize: history.reduce((sum, m) => sum + (typeof m.jsHeapSize === 'number' ? m.jsHeapSize : 0), 0) / history.length,
    } : {
      cpu: 0,
      memory: 0,
      apiResponseTime: 0,
      errorRate: 0,
      fps: 0,
      pageLoadTime: 0,
      domNodes: 0,
      jsHeapSize: 0,
    };

    setStats(prev => ({
      ...prev,
      totalSamples: history.length,
      uptime,
      averageMetrics,
      lastUpdated: now,
    }));
  }, []);

  /**
   * 开始性能监控
   * 
   * 启动定期收集性能指标的过程，设置PerformanceObserver监听资源加载事件
   * 如果已经在监控中，则忽略此调用
   * 
   * @example
   * ```typescript
   * // 在组件挂载时开始监控
   * useEffect(() => {
   *   startMonitoring();
   * }, []);
   * ```
   */
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    startTimeRef.current = Date.now();
    
    // 设置性能观察器
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'resource') {
              apiCallsRef.current.start++;
              const resourceEntry = entry as PerformanceResourceTiming;
              if (entry.name.includes('error') || 
                  (resourceEntry.responseStatus && resourceEntry.responseStatus >= 400)) {
                apiCallsRef.current.error++;
              } else {
                apiCallsRef.current.success++;
              }
            }
          });
        });
        
        observer.observe({ entryTypes: ['resource', 'navigation', 'measure'] });
        performanceObserverRef.current = observer;
      } catch (error) {
        console.warn('PerformanceObserver not supported:', error);
      }
    }

    // 开始定期收集指标
    intervalRef.current = setInterval(() => {
      try {
        const metrics = collectMetrics();
        setCurrentMetrics(metrics);
        
        setMetricsHistory(prev => {
          const newHistory = [...prev, metrics];
          // 限制历史数据数量
          if (newHistory.length > config.maxDataPoints) {
            newHistory.splice(0, newHistory.length - config.maxDataPoints);
          }
          
          updateStats(metrics, newHistory);
          return newHistory;
        });
        
        checkThresholds(metrics);
        events.onMetricsUpdate?.(metrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
        events.onError?.(error as Error);
      }
    }, config.sampleInterval);

    events.onMonitoringStart?.();
  }, [isMonitoring, config, collectMetrics, checkThresholds, updateStats, events]);

  /**
   * 停止性能监控
   * 
   * 停止定期收集性能指标，清理定时器和PerformanceObserver
   * 如果当前没有在监控，则忽略此调用
   * 
   * @example
   * ```typescript
   * // 在组件卸载时停止监控
   * useEffect(() => {
   *   return () => {
   *     stopMonitoring();
   *   };
   * }, []);
   * ```
   */
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (performanceObserverRef.current) {
      performanceObserverRef.current.disconnect();
      performanceObserverRef.current = null;
    }

    events.onMonitoringStop?.();
  }, [isMonitoring, events]);

  // 清除历史数据
  const clearHistory = useCallback(() => {
    setMetricsHistory([]);
    setCurrentMetrics(null);
    setProfilerData([]);
    apiCallsRef.current = { start: 0, success: 0, error: 0 };
    fpsRef.current = { frames: 0, lastTime: 0 };
  }, []);

  // 添加自定义指标
  const addMetric = useCallback((metric: Partial<PerformanceMetrics>) => {
    const timestamp = Date.now();
    const fullMetric: PerformanceMetrics = {
      cpu: 0,
      memory: 0,
      apiResponseTime: 0,
      errorRate: 0,
      timestamp,
      ...metric,
    };
    
    setMetricsHistory(prev => {
      const newHistory = [...prev, fullMetric];
      if (newHistory.length > config.maxDataPoints) {
        newHistory.splice(0, newHistory.length - config.maxDataPoints);
      }
      return newHistory;
    });
  }, [config.maxDataPoints]);

  // 标记警告为已读
  const markAlertAsRead = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  }, []);

  // 清除所有警告
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setStats(prev => ({
      ...prev,
      alertCount: { info: 0, warning: 0, critical: 0 },
    }));
  }, []);

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<PerformanceMonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // 获取性能报告
  const getPerformanceReport = useCallback(() => {
    const trends = calculateTrends(metricsHistory);
    const recommendations: string[] = [];

    // 生成建议
    if (stats.averageMetrics.cpu > 70) {
      recommendations.push('CPU使用率较高，建议优化计算密集型操作');
    }
    if (stats.averageMetrics.memory > 512) {
      recommendations.push('内存使用量较高，建议检查内存泄漏');
    }
    if (stats.averageMetrics.apiResponseTime > 1000) {
      recommendations.push('API响应时间较长，建议优化网络请求');
    }
    if (stats.averageMetrics.errorRate > 5) {
      recommendations.push('错误率较高，建议检查错误处理逻辑');
    }

    return {
      summary: stats,
      trends,
      alerts: alerts.filter(alert => !alert.read),
      recommendations,
    };
  }, [metricsHistory, stats, alerts, calculateTrends]);

  // React Profiler 回调
  const onRenderCallback = useCallback((
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    const profilerEntry: ReactProfilerData = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      timestamp: Date.now(),
    };
    
    setProfilerData(prev => {
      const newData = [...prev, profilerEntry];
      // 限制数据量
      if (newData.length > 50) {
        newData.splice(0, newData.length - 50);
      }
      return newData;
    });
  }, []);

  // 计算趋势
  const trends = calculateTrends(metricsHistory);

  // 更新警告统计
  useEffect(() => {
    const alertCount = alerts.reduce(
      (acc, alert) => {
        if (!alert.read) {
          acc[alert.level]++;
        }
        return acc;
      },
      { info: 0, warning: 0, critical: 0 }
    );
    
    setStats(prev => ({ ...prev, alertCount }));
  }, [alerts]);

  // 清理
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    currentMetrics,
    metricsHistory,
    trends,
    alerts,
    stats,
    profilerData,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearHistory,
    addMetric,
    markAlertAsRead,
    clearAlerts,
    updateConfig,
    getPerformanceReport,
    // 导出 React Profiler 回调供组件使用
    onRenderCallback,
  };
}

export default usePerformanceMetrics;