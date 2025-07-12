/**
 * Hooks 模块统一导出
 * 提供项目中所有自定义 React Hooks 的统一入口
 */

// 本地存储相关 Hooks
export {
  useLocalStorage,
  useSessionStorage,
  useUserPreferences,
  type UserPreferences
} from './useLocalStorage'

// WebSocket 连接管理 Hooks
export {
  useWebSocket,
  ReadyState,
  getReadyStateText,
  type WebSocketOptions,
  type UseWebSocketReturn
} from './useWebSocket'

// 实时数据管理 Hooks
export {
  useRealTimeData,
  useMessageFilter,
  useNotificationManager,
  type RealTimeDataState,
  type UseRealTimeDataOptions,
  type UseRealTimeDataReturn
} from './useRealTimeData'

// 实时指标计算 Hooks
export {
  useRealTimeMetrics,
  type UseRealTimeMetricsOptions,
  type UseRealTimeMetricsReturn,
  type MetricsState,
  type MetricsError,
  type MetricResult,
  type BaseMetricsCalculator
} from './useRealTimeMetrics'

// 从useRealTimeMetrics导出MetricType
export type { MetricType } from './useRealTimeMetrics'