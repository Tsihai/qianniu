import { SlidingWindowConfig, MetricsData } from '@/types'
import { cleanupExpiredData, calculateAverage, calculateStandardDeviation } from './utils'

/**
 * 数据点接口
 */
export interface DataPoint {
  timestamp: number
  value: number
  metadata?: Record<string, any>
}

/**
 * 窗口统计信息
 */
export interface WindowStats {
  count: number
  sum: number
  average: number
  min: number
  max: number
  latest: number
  standardDeviation: number
  percentile95: number
}

/**
 * 循环缓冲区实现，优化内存使用
 */
class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private tail = 0
  private size = 0
  private readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  /**
   * 添加元素到缓冲区
   */
  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity
    
    if (this.size < this.capacity) {
      this.size++
    } else {
      // 缓冲区已满，移动头指针
      this.head = (this.head + 1) % this.capacity
    }
  }

  /**
   * 获取所有有效元素
   */
  toArray(): T[] {
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity
      result.push(this.buffer[index])
    }
    return result
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.head = 0
    this.tail = 0
    this.size = 0
  }

  /**
   * 获取当前大小
   */
  getSize(): number {
    return this.size
  }

  /**
   * 获取容量
   */
  getCapacity(): number {
    return this.capacity
  }

  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this.size === 0
  }

  /**
   * 检查是否已满
   */
  isFull(): boolean {
    return this.size === this.capacity
  }
}

/**
 * 高性能滑动窗口数据结构
 */
export class SlidingWindow {
  private buffer: CircularBuffer<DataPoint>
  private windowSize: number
  private maxDataPoints: number
  private enableCompression: boolean
  private compressionRatio: number
  private lastCleanupTime = 0
  private cleanupInterval = 5000 // 5秒清理一次

  constructor(config: SlidingWindowConfig) {
    this.windowSize = config.windowSize
    this.maxDataPoints = config.maxDataPoints || 10000
    this.enableCompression = config.enableCompression || false
    this.compressionRatio = config.compressionRatio || 0.5
    
    // 初始化循环缓冲区
    this.buffer = new CircularBuffer<DataPoint>(this.maxDataPoints)
  }

  /**
   * 添加数据点
   */
  addDataPoint(point: DataPoint): void {
    // 验证数据点
    if (!this.isValidDataPoint(point)) {
      console.warn('Invalid data point:', point)
      return
    }

    // 添加到缓冲区
    this.buffer.push(point)

    // 定期清理过期数据
    const now = Date.now()
    if (now - this.lastCleanupTime > this.cleanupInterval) {
      this.cleanExpiredData(now)
      this.lastCleanupTime = now
    }

    // 如果启用压缩且缓冲区接近满载，执行数据压缩
    if (this.enableCompression && this.buffer.getSize() > this.maxDataPoints * 0.9) {
      this.compressData()
    }
  }

  /**
   * 清理过期数据
   */
  cleanExpiredData(currentTime: number = Date.now()): void {
    const cutoffTime = currentTime - this.windowSize
    const allData = this.buffer.toArray()
    
    // 找到第一个未过期的数据点
    let validStartIndex = 0
    for (let i = 0; i < allData.length; i++) {
      if (allData[i].timestamp >= cutoffTime) {
        validStartIndex = i
        break
      }
    }

    // 如果有过期数据，重建缓冲区
    if (validStartIndex > 0) {
      const validData = allData.slice(validStartIndex)
      this.buffer.clear()
      validData.forEach(point => this.buffer.push(point))
    }
  }

  /**
   * 获取窗口内的所有数据点
   */
  getDataPoints(currentTime: number = Date.now()): DataPoint[] {
    this.cleanExpiredData(currentTime)
    return this.buffer.toArray()
  }

  /**
   * 获取指定时间范围内的数据
   */
  getDataInRange(startTime: number, endTime: number): DataPoint[] {
    const allData = this.buffer.toArray()
    return allData.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    )
  }

  /**
   * 计算窗口统计信息
   */
  getStatistics(currentTime: number = Date.now()): WindowStats {
    const dataPoints = this.getDataPoints(currentTime)
    
    if (dataPoints.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
        latest: 0,
        standardDeviation: 0,
        percentile95: 0
      }
    }

    const values = dataPoints.map(point => point.value)
    const sum = values.reduce((acc, val) => acc + val, 0)
    const average = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const latest = dataPoints[dataPoints.length - 1]?.value || 0
    const standardDeviation = calculateStandardDeviation(values)
    
    // 计算95百分位数
    const sortedValues = [...values].sort((a, b) => a - b)
    const p95Index = Math.floor(sortedValues.length * 0.95)
    const percentile95 = sortedValues[p95Index] || 0

    return {
      count: dataPoints.length,
      sum,
      average,
      min,
      max,
      latest,
      standardDeviation,
      percentile95
    }
  }

  /**
   * 获取采样数据（用于图表显示）
   */
  getSampledData(maxPoints: number = 100, currentTime: number = Date.now()): DataPoint[] {
    const dataPoints = this.getDataPoints(currentTime)
    
    if (dataPoints.length <= maxPoints) {
      return dataPoints
    }

    // 使用等间距采样
    const step = Math.floor(dataPoints.length / maxPoints)
    const sampledData: DataPoint[] = []
    
    for (let i = 0; i < dataPoints.length; i += step) {
      sampledData.push(dataPoints[i])
    }

    // 确保包含最后一个数据点
    if (sampledData[sampledData.length - 1] !== dataPoints[dataPoints.length - 1]) {
      sampledData.push(dataPoints[dataPoints.length - 1])
    }

    return sampledData
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.buffer.clear()
    this.lastCleanupTime = 0
  }

  /**
   * 获取窗口配置信息
   */
  getConfig(): SlidingWindowConfig {
    return {
      windowSize: this.windowSize,
      maxDataPoints: this.maxDataPoints,
      enableCompression: this.enableCompression,
      compressionRatio: this.compressionRatio
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): {
    currentSize: number
    maxSize: number
    utilizationRate: number
  } {
    const currentSize = this.buffer.getSize()
    const maxSize = this.buffer.getCapacity()
    const utilizationRate = (currentSize / maxSize) * 100

    return {
      currentSize,
      maxSize,
      utilizationRate
    }
  }

  /**
   * 验证数据点有效性
   */
  private isValidDataPoint(point: DataPoint): boolean {
    return (
      typeof point === 'object' &&
      typeof point.timestamp === 'number' &&
      typeof point.value === 'number' &&
      Number.isFinite(point.timestamp) &&
      Number.isFinite(point.value) &&
      point.timestamp > 0
    )
  }

  /**
   * 数据压缩（保留关键数据点）
   */
  private compressData(): void {
    const allData = this.buffer.toArray()
    const targetSize = Math.floor(allData.length * this.compressionRatio)
    
    if (targetSize >= allData.length) {
      return
    }

    // 保留最新的数据点和关键统计点
    const recentData = allData.slice(-Math.floor(targetSize * 0.7))
    const sampledOldData = this.sampleOldData(allData.slice(0, -Math.floor(targetSize * 0.7)), Math.floor(targetSize * 0.3))
    
    const compressedData = [...sampledOldData, ...recentData]
    
    // 重建缓冲区
    this.buffer.clear()
    compressedData.forEach(point => this.buffer.push(point))
  }

  /**
   * 对旧数据进行采样
   */
  private sampleOldData(data: DataPoint[], targetCount: number): DataPoint[] {
    if (data.length <= targetCount) {
      return data
    }

    const step = Math.floor(data.length / targetCount)
    const sampledData: DataPoint[] = []
    
    for (let i = 0; i < data.length; i += step) {
      sampledData.push(data[i])
    }

    return sampledData.slice(0, targetCount)
  }
}

/**
 * 多窗口管理器
 */
export class MultiWindowManager {
  private windows = new Map<string, SlidingWindow>()

  /**
   * 创建或获取滑动窗口
   */
  getWindow(key: string, config: SlidingWindowConfig): SlidingWindow {
    if (!this.windows.has(key)) {
      this.windows.set(key, new SlidingWindow(config))
    }
    return this.windows.get(key)!
  }

  /**
   * 添加数据到指定窗口
   */
  addDataPoint(windowKey: string, point: DataPoint, config: SlidingWindowConfig): void {
    const window = this.getWindow(windowKey, config)
    window.addDataPoint(point)
  }

  /**
   * 获取指定窗口的统计信息
   */
  getWindowStats(windowKey: string): WindowStats | null {
    const window = this.windows.get(windowKey)
    return window ? window.getStatistics() : null
  }

  /**
   * 获取所有窗口的统计信息
   */
  getAllWindowStats(): Record<string, WindowStats> {
    const stats: Record<string, WindowStats> = {}
    
    this.windows.forEach((window, key) => {
      stats[key] = window.getStatistics()
    })
    
    return stats
  }

  /**
   * 清理指定窗口
   */
  clearWindow(windowKey: string): void {
    const window = this.windows.get(windowKey)
    if (window) {
      window.clear()
    }
  }

  /**
   * 清理所有窗口
   */
  clearAllWindows(): void {
    this.windows.forEach(window => window.clear())
  }

  /**
   * 删除窗口
   */
  removeWindow(windowKey: string): void {
    this.windows.delete(windowKey)
  }

  /**
   * 获取窗口数量
   */
  getWindowCount(): number {
    return this.windows.size
  }

  /**
   * 获取所有窗口的内存使用情况
   */
  getMemoryUsage(): Record<string, any> {
    const usage: Record<string, any> = {}
    
    this.windows.forEach((window, key) => {
      usage[key] = window.getMemoryUsage()
    })
    
    return usage
  }
}

// 导出默认实例
export const multiWindowManager = new MultiWindowManager()