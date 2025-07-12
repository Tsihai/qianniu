import { MetricsData, MetricsCalculator, SlidingWindowConfig } from '@/types'
import { SlidingWindow, DataPoint, WindowStats } from './slidingWindow'
import { calculateAverage, calculateRatePerMinute, aggregateMetrics } from './utils'
import { METRICS_TYPE, METRICS_THRESHOLDS } from './constants'

/**
 * 指标计算结果接口
 */
export interface MetricResult {
  value: number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * 基础指标计算器抽象类
 */
export abstract class BaseMetricsCalculator implements MetricsCalculator {
  protected slidingWindow: SlidingWindow
  protected metricType: string
  protected thresholds: { warning: number; critical: number }

  constructor(
    slidingWindow: SlidingWindow,
    metricType: string,
    thresholds: { warning: number; critical: number }
  ) {
    this.slidingWindow = slidingWindow
    this.metricType = metricType
    this.thresholds = thresholds
  }

  /**
   * 添加数据点
   */
  addDataPoint(value: number, timestamp: number = Date.now(), metadata?: Record<string, any>): void {
    const dataPoint: DataPoint = {
      timestamp,
      value,
      metadata
    }
    this.slidingWindow.addDataPoint(dataPoint)
  }

  /**
   * 计算指标值（抽象方法）
   */
  abstract calculate(): MetricResult

  /**
   * 获取窗口统计信息
   */
  public getWindowStats(): WindowStats {
    return this.slidingWindow.getStatistics()
  }

  /**
   * 确定状态级别
   */
  protected determineStatus(value: number): 'normal' | 'warning' | 'critical' {
    if (value >= this.thresholds.critical) {
      return 'critical'
    } else if (value >= this.thresholds.warning) {
      return 'warning'
    }
    return 'normal'
  }

  /**
   * 计算趋势
   */
  protected calculateTrend(): 'up' | 'down' | 'stable' {
    const dataPoints = this.slidingWindow.getDataPoints()
    if (dataPoints.length < 2) {
      return 'stable'
    }

    const recentPoints = dataPoints.slice(-10) // 取最近10个点
    if (recentPoints.length < 2) {
      return 'stable'
    }

    const firstHalf = recentPoints.slice(0, Math.floor(recentPoints.length / 2))
    const secondHalf = recentPoints.slice(Math.floor(recentPoints.length / 2))

    const firstAvg = calculateAverage(firstHalf.map(p => p.value))
    const secondAvg = calculateAverage(secondHalf.map(p => p.value))

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100

    if (Math.abs(changePercent) < 5) {
      return 'stable'
    }
    return changePercent > 0 ? 'up' : 'down'
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.slidingWindow.clear()
  }

  /**
   * 获取配置信息
   */
  getConfig(): {
    metricType: string
    thresholds: { warning: number; critical: number }
    windowConfig: any
  } {
    return {
      metricType: this.metricType,
      thresholds: this.thresholds,
      windowConfig: this.slidingWindow.getConfig()
    }
  }

  /**
   * 清理过期数据点
   */
  cleanup(currentTime: number): void {
    this.slidingWindow.cleanExpiredData(currentTime)
  }

  /**
   * 获取所有数据点
   */
  getAllDataPoints(): SlidingWindowConfig[] {
    const dataPoints = this.slidingWindow.getDataPoints()
    return dataPoints.map(point => ({
      windowSize: this.slidingWindow.getConfig().windowSize,
      timestamp: point.timestamp,
      value: point.value
    }))
  }
}

/**
 * 消息处理率计算器
 */
export class MessageRateCalculator extends BaseMetricsCalculator {
  constructor(slidingWindow: SlidingWindow) {
    super(
      slidingWindow,
      METRICS_TYPE.MESSAGE_RATE,
      {
        warning: METRICS_THRESHOLDS.MESSAGE_RATE.WARNING,
        critical: METRICS_THRESHOLDS.MESSAGE_RATE.CRITICAL
      }
    )
  }

  calculate(): MetricResult {
    const stats = this.getWindowStats()
    const windowSizeMinutes = this.slidingWindow.getConfig().windowSize / (60 * 1000)
    const rate = stats.count / windowSizeMinutes

    return {
      value: Number(rate.toFixed(2)),
      unit: 'messages/min',
      status: this.determineStatus(rate),
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        totalMessages: stats.count,
        windowSize: windowSizeMinutes,
        averageValue: stats.average
      }
    }
  }
}

/**
 * 响应时间计算器
 */
export class ResponseTimeCalculator extends BaseMetricsCalculator {
  constructor(slidingWindow: SlidingWindow) {
    super(
      slidingWindow,
      METRICS_TYPE.RESPONSE_TIME,
      {
        warning: METRICS_THRESHOLDS.RESPONSE_TIME.WARNING,
        critical: METRICS_THRESHOLDS.RESPONSE_TIME.CRITICAL
      }
    )
  }

  calculate(): MetricResult {
    const stats = this.getWindowStats()
    const averageResponseTime = stats.average

    return {
      value: Number(averageResponseTime.toFixed(2)),
      unit: 'ms',
      status: this.determineStatus(averageResponseTime),
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        count: stats.count,
        min: stats.min,
        max: stats.max,
        p95: stats.percentile95,
        standardDeviation: stats.standardDeviation
      }
    }
  }
}

/**
 * 错误率计算器
 */
export class ErrorRateCalculator extends BaseMetricsCalculator {
  private totalRequestsWindow: SlidingWindow

  constructor(errorWindow: SlidingWindow, totalRequestsWindow: SlidingWindow) {
    super(
      errorWindow,
      METRICS_TYPE.ERROR_RATE,
      {
        warning: METRICS_THRESHOLDS.ERROR_RATE.WARNING,
        critical: METRICS_THRESHOLDS.ERROR_RATE.CRITICAL
      }
    )
    this.totalRequestsWindow = totalRequestsWindow
  }

  /**
   * 添加总请求数据点
   */
  addTotalRequestDataPoint(value: number, timestamp: number = Date.now()): void {
    this.totalRequestsWindow.addDataPoint({ timestamp, value })
  }

  calculate(): MetricResult {
    const errorStats = this.getWindowStats()
    const totalStats = this.totalRequestsWindow.getStatistics()
    
    const errorRate = totalStats.count > 0 ? (errorStats.count / totalStats.count) * 100 : 0

    return {
      value: Number(errorRate.toFixed(2)),
      unit: '%',
      status: this.determineStatus(errorRate),
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        errorCount: errorStats.count,
        totalCount: totalStats.count,
        errorTypes: this.getErrorTypes()
      }
    }
  }

  /**
   * 获取错误类型统计
   */
  private getErrorTypes(): Record<string, number> {
    const dataPoints = this.slidingWindow.getDataPoints()
    const errorTypes: Record<string, number> = {}

    dataPoints.forEach(point => {
      if (point.metadata?.errorType) {
        const type = point.metadata.errorType
        errorTypes[type] = (errorTypes[type] || 0) + 1
      }
    })

    return errorTypes
  }
}

/**
 * 连接稳定性计算器
 */
export class ConnectionStabilityCalculator extends BaseMetricsCalculator {
  private disconnectionWindow: SlidingWindow

  constructor(connectionWindow: SlidingWindow, disconnectionWindow: SlidingWindow) {
    super(
      connectionWindow,
      METRICS_TYPE.CONNECTION_STABILITY,
      {
        warning: METRICS_THRESHOLDS.CONNECTION_STABILITY.WARNING,
        critical: METRICS_THRESHOLDS.CONNECTION_STABILITY.CRITICAL
      }
    )
    this.disconnectionWindow = disconnectionWindow
  }

  /**
   * 添加断连数据点
   */
  addDisconnectionDataPoint(value: number, timestamp: number = Date.now()): void {
    this.disconnectionWindow.addDataPoint({ timestamp, value })
  }

  calculate(): MetricResult {
    const connectionStats = this.getWindowStats()
    const disconnectionStats = this.disconnectionWindow.getStatistics()
    
    // 计算稳定性百分比（连接时间 / 总时间）
    const totalTime = connectionStats.sum + disconnectionStats.sum
    const stability = totalTime > 0 ? (connectionStats.sum / totalTime) * 100 : 100

    return {
      value: Number(stability.toFixed(2)),
      unit: '%',
      status: this.determineStatus(100 - stability), // 反向判断，不稳定性越高状态越差
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        connectionTime: connectionStats.sum,
        disconnectionTime: disconnectionStats.sum,
        disconnectionCount: disconnectionStats.count,
        averageConnectionDuration: connectionStats.average,
        averageDisconnectionDuration: disconnectionStats.average
      }
    }
  }
}

/**
 * 客服工作负载计算器
 */
export class AgentWorkloadCalculator extends BaseMetricsCalculator {
  private activeSessionsWindow: SlidingWindow
  private maxConcurrentSessions: number

  constructor(
    workloadWindow: SlidingWindow,
    activeSessionsWindow: SlidingWindow,
    maxConcurrentSessions: number = 10
  ) {
    super(
      workloadWindow,
      METRICS_TYPE.AGENT_WORKLOAD,
      {
        warning: METRICS_THRESHOLDS.AGENT_WORKLOAD.WARNING,
        critical: METRICS_THRESHOLDS.AGENT_WORKLOAD.CRITICAL
      }
    )
    this.activeSessionsWindow = activeSessionsWindow
    this.maxConcurrentSessions = maxConcurrentSessions
  }

  /**
   * 添加活跃会话数据点
   */
  addActiveSessionDataPoint(value: number, timestamp: number = Date.now()): void {
    this.activeSessionsWindow.addDataPoint({ timestamp, value })
  }

  /**
   * 设置最大并发会话数
   */
  setMaxConcurrentSessions(max: number): void {
    this.maxConcurrentSessions = max
  }

  calculate(): MetricResult {
    const workloadStats = this.getWindowStats()
    const sessionStats = this.activeSessionsWindow.getStatistics()
    
    // 计算工作负载百分比
    const workloadPercentage = this.maxConcurrentSessions > 0 
      ? (sessionStats.average / this.maxConcurrentSessions) * 100 
      : 0

    return {
      value: Number(workloadPercentage.toFixed(2)),
      unit: '%',
      status: this.determineStatus(workloadPercentage),
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        averageActiveSessions: sessionStats.average,
        maxActiveSessions: sessionStats.max,
        minActiveSessions: sessionStats.min,
        maxConcurrentSessions: this.maxConcurrentSessions,
        totalMessages: workloadStats.count,
        averageResponseTime: workloadStats.average
      }
    }
  }
}

/**
 * 系统性能计算器
 */
export class SystemPerformanceCalculator extends BaseMetricsCalculator {
  private cpuWindow: SlidingWindow
  private memoryWindow: SlidingWindow

  constructor(
    performanceWindow: SlidingWindow,
    cpuWindow: SlidingWindow,
    memoryWindow: SlidingWindow
  ) {
    super(
      performanceWindow,
      METRICS_TYPE.SYSTEM_PERFORMANCE,
      {
        warning: 70,
        critical: 90
      }
    )
    this.cpuWindow = cpuWindow
    this.memoryWindow = memoryWindow
  }

  /**
   * 添加CPU使用率数据点
   */
  addCpuDataPoint(value: number, timestamp: number = Date.now()): void {
    this.cpuWindow.addDataPoint({ timestamp, value })
  }

  /**
   * 添加内存使用率数据点
   */
  addMemoryDataPoint(value: number, timestamp: number = Date.now()): void {
    this.memoryWindow.addDataPoint({ timestamp, value })
  }

  calculate(): MetricResult {
    const cpuStats = this.cpuWindow.getStatistics()
    const memoryStats = this.memoryWindow.getStatistics()
    
    // 综合性能评分（CPU和内存的加权平均）
    const performanceScore = (cpuStats.average * 0.6 + memoryStats.average * 0.4)

    return {
      value: Number(performanceScore.toFixed(2)),
      unit: '%',
      status: this.determineStatus(performanceScore),
      trend: this.calculateTrend(),
      timestamp: Date.now(),
      metadata: {
        cpuUsage: {
          average: cpuStats.average,
          max: cpuStats.max,
          min: cpuStats.min,
          p95: cpuStats.percentile95
        },
        memoryUsage: {
          average: memoryStats.average,
          max: memoryStats.max,
          min: memoryStats.min,
          p95: memoryStats.percentile95
        }
      }
    }
  }
}

/**
 * 指标计算器工厂类
 */
export class MetricsCalculatorFactory {
  private calculators = new Map<string, BaseMetricsCalculator>()
  private slidingWindows = new Map<string, SlidingWindow>()

  /**
   * 创建滑动窗口
   */
  private createSlidingWindow(key: string, windowSize: number, maxDataPoints: number = 1000): SlidingWindow {
    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, new SlidingWindow({
        windowSize,
        maxDataPoints,
        enableCompression: true,
        compressionRatio: 0.7
      }))
    }
    return this.slidingWindows.get(key)!
  }

  /**
   * 创建消息处理率计算器
   */
  createMessageRateCalculator(windowSize: number = 300000): MessageRateCalculator {
    const key = `message_rate_${windowSize}`
    if (!this.calculators.has(key)) {
      const window = this.createSlidingWindow(key, windowSize)
      this.calculators.set(key, new MessageRateCalculator(window))
    }
    return this.calculators.get(key) as MessageRateCalculator
  }

  /**
   * 创建响应时间计算器
   */
  createResponseTimeCalculator(windowSize: number = 300000): ResponseTimeCalculator {
    const key = `response_time_${windowSize}`
    if (!this.calculators.has(key)) {
      const window = this.createSlidingWindow(key, windowSize)
      this.calculators.set(key, new ResponseTimeCalculator(window))
    }
    return this.calculators.get(key) as ResponseTimeCalculator
  }

  /**
   * 创建错误率计算器
   */
  createErrorRateCalculator(windowSize: number = 300000): ErrorRateCalculator {
    const key = `error_rate_${windowSize}`
    if (!this.calculators.has(key)) {
      const errorWindow = this.createSlidingWindow(`${key}_errors`, windowSize)
      const totalWindow = this.createSlidingWindow(`${key}_total`, windowSize)
      this.calculators.set(key, new ErrorRateCalculator(errorWindow, totalWindow))
    }
    return this.calculators.get(key) as ErrorRateCalculator
  }

  /**
   * 创建连接稳定性计算器
   */
  createConnectionStabilityCalculator(windowSize: number = 300000): ConnectionStabilityCalculator {
    const key = `connection_stability_${windowSize}`
    if (!this.calculators.has(key)) {
      const connectionWindow = this.createSlidingWindow(`${key}_connections`, windowSize)
      const disconnectionWindow = this.createSlidingWindow(`${key}_disconnections`, windowSize)
      this.calculators.set(key, new ConnectionStabilityCalculator(connectionWindow, disconnectionWindow))
    }
    return this.calculators.get(key) as ConnectionStabilityCalculator
  }

  /**
   * 创建客服工作负载计算器
   */
  createAgentWorkloadCalculator(
    windowSize: number = 300000,
    maxConcurrentSessions: number = 10
  ): AgentWorkloadCalculator {
    const key = `agent_workload_${windowSize}_${maxConcurrentSessions}`
    if (!this.calculators.has(key)) {
      const workloadWindow = this.createSlidingWindow(`${key}_workload`, windowSize)
      const sessionsWindow = this.createSlidingWindow(`${key}_sessions`, windowSize)
      this.calculators.set(key, new AgentWorkloadCalculator(workloadWindow, sessionsWindow, maxConcurrentSessions))
    }
    return this.calculators.get(key) as AgentWorkloadCalculator
  }

  /**
   * 创建系统性能计算器
   */
  createSystemPerformanceCalculator(windowSize: number = 300000): SystemPerformanceCalculator {
    const key = `system_performance_${windowSize}`
    if (!this.calculators.has(key)) {
      const performanceWindow = this.createSlidingWindow(`${key}_performance`, windowSize)
      const cpuWindow = this.createSlidingWindow(`${key}_cpu`, windowSize)
      const memoryWindow = this.createSlidingWindow(`${key}_memory`, windowSize)
      this.calculators.set(key, new SystemPerformanceCalculator(performanceWindow, cpuWindow, memoryWindow))
    }
    return this.calculators.get(key) as SystemPerformanceCalculator
  }

  /**
   * 获取指定类型的计算器
   */
  getCalculator(metricType: string, windowSize: number = 300000): BaseMetricsCalculator | null {
    switch (metricType) {
      case METRICS_TYPE.MESSAGE_RATE:
        return this.createMessageRateCalculator(windowSize)
      case METRICS_TYPE.RESPONSE_TIME:
        return this.createResponseTimeCalculator(windowSize)
      case METRICS_TYPE.ERROR_RATE:
        return this.createErrorRateCalculator(windowSize)
      case METRICS_TYPE.CONNECTION_STABILITY:
        return this.createConnectionStabilityCalculator(windowSize)
      case METRICS_TYPE.AGENT_WORKLOAD:
        return this.createAgentWorkloadCalculator(windowSize)
      case METRICS_TYPE.SYSTEM_PERFORMANCE:
        return this.createSystemPerformanceCalculator(windowSize)
      default:
        return null
    }
  }

  /**
   * 获取所有计算器
   */
  getAllCalculators(): Map<string, BaseMetricsCalculator> {
    return new Map(this.calculators)
  }

  /**
   * 清理指定计算器
   */
  clearCalculator(key: string): void {
    const calculator = this.calculators.get(key)
    if (calculator) {
      calculator.clear()
    }
  }

  /**
   * 清理所有计算器
   */
  clearAllCalculators(): void {
    this.calculators.forEach(calculator => calculator.clear())
  }

  /**
   * 删除计算器
   */
  removeCalculator(key: string): void {
    this.calculators.delete(key)
    // 清理相关的滑动窗口
    const windowKeys = Array.from(this.slidingWindows.keys()).filter(k => k.startsWith(key))
    windowKeys.forEach(k => this.slidingWindows.delete(k))
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): Record<string, any> {
    const usage: Record<string, any> = {
      calculatorCount: this.calculators.size,
      windowCount: this.slidingWindows.size,
      windows: {}
    }

    this.slidingWindows.forEach((window, key) => {
      usage.windows[key] = window.getMemoryUsage()
    })

    return usage
  }
}

// 导出默认工厂实例
export const metricsCalculatorFactory = new MetricsCalculatorFactory()