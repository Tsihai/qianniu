import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
  return obj
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const target = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return '刚刚'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}分钟前`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}小时前`
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}天前`
  } else {
    return formatDate(target)
  }
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number (Chinese)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Truncate text
 */
export function truncate(text: string, length: number, suffix = '...'): string {
  if (text.length <= length) return text
  return text.substring(0, length) + suffix
}

/**
 * Get random item from array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Remove duplicates from array
 */
export function removeDuplicates<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return [...new Set(array)]
  }
  const seen = new Set()
  return array.filter(item => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

/**
 * Group array by key
 */
export function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String(item[key])
    groups[group] = groups[group] || []
    groups[group].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * Sort array by multiple keys
 */
export function sortBy<T>(
  array: T[],
  ...keys: Array<keyof T | ((item: T) => any)>
): T[] {
  return array.sort((a, b) => {
    for (const key of keys) {
      const aVal = typeof key === 'function' ? key(a) : a[key]
      const bVal = typeof key === 'function' ? key(b) : b[key]
      
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
    }
    return 0
  })
}

/**
 * Convert object to query string
 */
export function objectToQueryString(obj: Record<string, any>): string {
  const params = new URLSearchParams()
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  return params.toString()
}

/**
 * Parse query string to object
 */
export function queryStringToObject(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textArea)
      return result
    }
  } catch (_error) {
    console.error('Failed to copy text:', _error)
    return false
  }
}

/**
 * Download data as file
 */
export function downloadAsFile(
  data: string,
  filename: string,
  type = 'text/plain'
): void {
  const blob = new Blob([data], { type })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency = 'CNY',
  locale = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount)
}

/**
 * Calculate percentage
 */
export function calculatePercentage(
  value: number,
  total: number,
  decimals = 2
): number {
  if (total === 0) return 0
  return Number(((value / total) * 100).toFixed(decimals))
}

// ==================== 实时指标计算工具函数 ====================

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100')
  }
  
  const sorted = [...values].sort((a, b) => a - b)
  const index = (percentile / 100) * (sorted.length - 1)
  
  if (Number.isInteger(index)) {
    return sorted[index]
  }
  
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = calculateAverage(values)
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
  const avgSquaredDiff = calculateAverage(squaredDiffs)
  
  return Math.sqrt(avgSquaredDiff)
}

/**
 * Create sliding window data structure
 */
export function createSlidingWindow<T extends { timestamp: number; value: number }>(
  windowSize: number
) {
  const data: T[] = []
  
  return {
    /**
     * Add data point to sliding window
     */
    addDataPoint: (point: T): void => {
      data.push(point)
      
      // Remove expired data points
      const cutoffTime = point.timestamp - windowSize
      while (data.length > 0 && data[0].timestamp < cutoffTime) {
        data.shift()
      }
    },
    
    /**
     * Get all data points in current window
     */
    getDataPoints: (): T[] => {
      return [...data]
    },
    
    /**
     * Get window statistics
     */
    getStats: () => {
      if (data.length === 0) {
        return {
          count: 0,
          sum: 0,
          average: 0,
          min: 0,
          max: 0,
          latest: 0
        }
      }
      
      const values = data.map(d => d.value)
      const sum = values.reduce((acc, val) => acc + val, 0)
      
      return {
        count: data.length,
        sum,
        average: sum / data.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: data[data.length - 1]?.value || 0
      }
    },
    
    /**
     * Clear all data points
     */
    clear: (): void => {
      data.length = 0
    },
    
    /**
     * Get data points count
     */
    size: (): number => {
      return data.length
    }
  }
}

/**
 * Aggregate metrics data for multiple time windows
 */
export function aggregateMetrics(
  dataPoints: Array<{ timestamp: number; value: number }>,
  windowSizes: number[],
  currentTime: number
) {
  const result: Record<string, any> = {}
  
  windowSizes.forEach(windowSize => {
    const cutoffTime = currentTime - windowSize
    const windowData = dataPoints.filter(point => point.timestamp >= cutoffTime)
    
    if (windowData.length === 0) {
      result[`${windowSize}ms`] = {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0
      }
      return
    }
    
    const values = windowData.map(d => d.value)
    const sum = values.reduce((acc, val) => acc + val, 0)
    
    result[`${windowSize}ms`] = {
      count: windowData.length,
      sum,
      average: sum / windowData.length,
      min: Math.min(...values),
      max: Math.max(...values)
    }
  })
  
  return result
}

/**
 * Format metric value with appropriate units
 */
export function formatMetricValue(
  value: number,
  type: 'rate' | 'time' | 'percentage' | 'count',
  decimals = 2
): string {
  switch (type) {
    case 'rate':
      return `${value.toFixed(decimals)}/min`
    case 'time':
      if (value < 1000) {
        return `${value.toFixed(decimals)}ms`
      } else if (value < 60000) {
        return `${(value / 1000).toFixed(decimals)}s`
      } else {
        return `${(value / 60000).toFixed(decimals)}min`
      }
    case 'percentage':
      return `${value.toFixed(decimals)}%`
    case 'count':
      return value.toFixed(0)
    default:
      return value.toFixed(decimals)
  }
}

/**
 * Validate time window configuration
 */
export function isValidTimeWindow(
  windowSize: number,
  minSize = 1000,
  maxSize = 3600000
): boolean {
  return (
    typeof windowSize === 'number' &&
    windowSize >= minSize &&
    windowSize <= maxSize &&
    Number.isFinite(windowSize)
  )
}

/**
 * Calculate rate per minute from count and time window
 */
export function calculateRatePerMinute(
  count: number,
  windowSizeMs: number
): number {
  if (windowSizeMs <= 0) return 0
  const windowSizeMinutes = windowSizeMs / (60 * 1000)
  return count / windowSizeMinutes
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  values: number[],
  windowSize: number
): number[] {
  if (values.length === 0 || windowSize <= 0) return []
  
  const result: number[] = []
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const window = values.slice(start, i + 1)
    const average = calculateAverage(window)
    result.push(average)
  }
  
  return result
}

/**
 * Detect anomalies in time series data using z-score
 */
export function detectAnomalies(
  values: number[],
  threshold = 2
): boolean[] {
  if (values.length < 2) return values.map(() => false)
  
  const mean = calculateAverage(values)
  const stdDev = calculateStandardDeviation(values)
  
  if (stdDev === 0) return values.map(() => false)
  
  return values.map(value => {
    const zScore = Math.abs((value - mean) / stdDev)
    return zScore > threshold
  })
}

/**
 * Clean up expired data points from array
 */
export function cleanupExpiredData<T extends { timestamp: number }>(
  data: T[],
  maxAge: number,
  currentTime: number = Date.now()
): T[] {
  const cutoffTime = currentTime - maxAge
  return data.filter(item => item.timestamp >= cutoffTime)
}

/**
 * Throttle function calls with timestamp tracking
 */
export function createThrottledCalculator(
  fn: (...args: any[]) => any,
  interval: number
) {
  let lastCallTime = 0
  let lastResult: any
  
  return (...args: any[]) => {
    const now = Date.now()
    
    if (now - lastCallTime >= interval) {
      lastResult = fn(...args)
      lastCallTime = now
    }
    
    return lastResult
  }
}