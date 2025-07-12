// 性能监控相关类型定义

// 性能指标数据
export interface PerformanceMetrics {
  /** CPU使用率（百分比，0-100） */
  cpu: number;
  /** 内存使用量（MB） */
  memory: number;
  /** API响应时间（毫秒） */
  apiResponseTime: number;
  /** 错误率（百分比，0-100） */
  errorRate: number;
  /** 时间戳 */
  timestamp: number;
  /** 帧率（FPS） */
  fps?: number;
  /** 页面加载时间（毫秒） */
  pageLoadTime?: number;
  /** DOM节点数量 */
  domNodes?: number;
  /** JavaScript堆大小（MB） */
  jsHeapSize?: number;
}

// 性能监控配置
export interface PerformanceMonitoringConfig {
  /** 采样间隔（毫秒） */
  sampleInterval: number;
  /** 最大数据点数量 */
  maxDataPoints: number;
  /** 是否启用CPU监控 */
  enableCpuMonitoring: boolean;
  /** 是否启用内存监控 */
  enableMemoryMonitoring: boolean;
  /** 是否启用API监控 */
  enableApiMonitoring: boolean;
  /** 是否启用错误监控 */
  enableErrorMonitoring: boolean;
  /** 是否启用FPS监控 */
  enableFpsMonitoring: boolean;
  /** 是否启用自动清理 */
  enableAutoCleanup: boolean;
}

// 性能趋势数据
export interface PerformanceTrend {
  /** 指标名称 */
  metric: keyof PerformanceMetrics;
  /** 数据点 */
  data: Array<{
    timestamp: number;
    value: number;
  }>;
  /** 平均值 */
  average: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 趋势方向 */
  trend: 'up' | 'down' | 'stable';
}

// 性能警告
export interface PerformanceAlert {
  id: string;
  /** 警告类型 */
  type: 'cpu' | 'memory' | 'api' | 'error' | 'fps';
  /** 警告级别 */
  level: 'info' | 'warning' | 'critical';
  /** 警告消息 */
  message: string;
  /** 当前值 */
  currentValue: number;
  /** 阈值 */
  threshold: number;
  /** 时间戳 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
}

// 性能阈值配置
export interface PerformanceThresholds {
  /** CPU使用率阈值 */
  cpu: {
    warning: number;
    critical: number;
  };
  /** 内存使用量阈值（MB） */
  memory: {
    warning: number;
    critical: number;
  };
  /** API响应时间阈值（毫秒） */
  apiResponseTime: {
    warning: number;
    critical: number;
  };
  /** 错误率阈值（百分比） */
  errorRate: {
    warning: number;
    critical: number;
  };
  /** FPS阈值 */
  fps: {
    warning: number;
    critical: number;
  };
}

// 性能统计信息
export interface PerformanceStats {
  /** 总采样次数 */
  totalSamples: number;
  /** 监控开始时间 */
  startTime: number;
  /** 监控运行时间（毫秒） */
  uptime: number;
  /** 警告数量 */
  alertCount: {
    info: number;
    warning: number;
    critical: number;
  };
  /** 平均性能指标 */
  averageMetrics: Omit<PerformanceMetrics, 'timestamp'>;
  /** 最后更新时间 */
  lastUpdated: number;
}

// React Profiler 数据
export interface ReactProfilerData {
  /** Profiler ID */
  id: string;
  /** 渲染阶段 */
  phase: 'mount' | 'update' | 'nested-update';
  /** 实际渲染时间（毫秒） */
  actualDuration: number;
  /** 基础渲染时间（毫秒） */
  baseDuration: number;
  /** 开始时间戳 */
  startTime: number;
  /** 提交时间戳 */
  commitTime: number;
  /** 时间戳 */
  timestamp: number;
}

// 性能监控Hook返回类型
export interface UsePerformanceMetricsReturn {
  /** 当前性能指标 */
  currentMetrics: PerformanceMetrics | null;
  /** 历史性能数据 */
  metricsHistory: PerformanceMetrics[];
  /** 性能趋势 */
  trends: PerformanceTrend[];
  /** 性能警告 */
  alerts: PerformanceAlert[];
  /** 性能统计 */
  stats: PerformanceStats;
  /** React Profiler 数据 */
  profilerData: ReactProfilerData[];
  /** 是否正在监控 */
  isMonitoring: boolean;
  
  // 操作方法
  /** 开始监控 */
  startMonitoring: () => void;
  /** 停止监控 */
  stopMonitoring: () => void;
  /** 清除历史数据 */
  clearHistory: () => void;
  /** 添加自定义指标 */
  addMetric: (metric: Partial<PerformanceMetrics>) => void;
  /** 标记警告为已读 */
  markAlertAsRead: (alertId: string) => void;
  /** 清除所有警告 */
  clearAlerts: () => void;
  /** 更新配置 */
  updateConfig: (config: Partial<PerformanceMonitoringConfig>) => void;
  /** 获取性能报告 */
  getPerformanceReport: () => {
    summary: PerformanceStats;
    trends: PerformanceTrend[];
    alerts: PerformanceAlert[];
    recommendations: string[];
  };
  /** React Profiler 回调函数 */
  onRenderCallback: (
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => void;
}

// 默认性能监控配置
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  sampleInterval: 5000, // 5秒
  maxDataPoints: 100,
  enableCpuMonitoring: true,
  enableMemoryMonitoring: true,
  enableApiMonitoring: true,
  enableErrorMonitoring: true,
  enableFpsMonitoring: true,
  enableAutoCleanup: true,
};

// 默认性能阈值
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  cpu: {
    warning: 70,
    critical: 90,
  },
  memory: {
    warning: 512, // 512MB
    critical: 1024, // 1GB
  },
  apiResponseTime: {
    warning: 1000, // 1秒
    critical: 3000, // 3秒
  },
  errorRate: {
    warning: 5, // 5%
    critical: 10, // 10%
  },
  fps: {
    warning: 30,
    critical: 15,
  },
};

// 性能监控事件类型
export interface PerformanceMonitoringEvents {
  onMetricsUpdate: (metrics: PerformanceMetrics) => void;
  onAlert: (alert: PerformanceAlert) => void;
  onThresholdExceeded: (metric: keyof PerformanceMetrics, value: number, threshold: number) => void;
  onMonitoringStart: () => void;
  onMonitoringStop: () => void;
  onError: (error: Error) => void;
}

// WebSocket连接质量监控
export interface WebSocketQuality {
  /** 连接质量评分（0-100） */
  score: number;
  /** 延迟时间（毫秒） */
  latency: number;
  /** 连接稳定性（0-100） */
  stability: number;
  /** 重连次数 */
  reconnectCount: number;
  /** 最后连接时间 */
  lastConnected: Date;
  /** 连接持续时间（毫秒） */
  connectionDuration?: number;
  /** 数据传输速率（bytes/s） */
  dataRate?: number;
  /** 丢包率（百分比） */
  packetLoss?: number;
}

// WebSocket连接事件
export interface ConnectionEvent {
  /** 事件类型 */
  type: 'connect' | 'disconnect' | 'error' | 'reconnect' | 'timeout';
  /** 事件时间戳 */
  timestamp: Date;
  /** 事件详细信息 */
  details?: string;
  /** 错误代码（仅错误事件） */
  errorCode?: number;
  /** 重连尝试次数（仅重连事件） */
  retryCount?: number;
  /** 连接URL */
  url?: string;
}

// WebSocket监控配置
export interface WebSocketMonitoringConfig {
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout: number;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
  /** 重连延迟（毫秒） */
  reconnectDelay: number;
  /** 是否启用自动重连 */
  enableAutoReconnect: boolean;
  /** 是否启用质量监控 */
  enableQualityMonitoring: boolean;
  /** 质量检测间隔（毫秒） */
  qualityCheckInterval: number;
}

// WebSocket监控状态
export interface WebSocketMonitoringState {
  /** 连接状态 */
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** 连接质量 */
  quality: WebSocketQuality;
  /** 连接事件历史 */
  eventHistory: ConnectionEvent[];
  /** 最后一次心跳时间 */
  lastHeartbeat: Date | null;
  /** 当前重连尝试次数 */
  currentRetryCount: number;
  /** 连接开始时间 */
  connectionStartTime: Date | null;
  /** 总数据传输量（bytes） */
  totalDataTransferred: number;
  /** 错误统计 */
  errorStats: {
    total: number;
    byType: Record<string, number>;
  };
}

// WebSocket监控Hook返回类型
export interface UseWebSocketMonitoringReturn {
  /** 监控状态 */
  state: WebSocketMonitoringState;
  /** 连接质量历史 */
  qualityHistory: WebSocketQuality[];
  /** 是否正在监控 */
  isMonitoring: boolean;
  
  // 操作方法
  /** 开始监控 */
  startMonitoring: (url: string) => void;
  /** 停止监控 */
  stopMonitoring: () => void;
  /** 手动重连 */
  reconnect: () => void;
  /** 发送心跳 */
  sendHeartbeat: () => void;
  /** 清除事件历史 */
  clearEventHistory: () => void;
  /** 更新配置 */
  updateConfig: (config: Partial<WebSocketMonitoringConfig>) => void;
  /** 获取连接报告 */
  getConnectionReport: () => {
    quality: WebSocketQuality;
    events: ConnectionEvent[];
    stats: {
      uptime: number;
      totalReconnects: number;
      averageLatency: number;
      errorRate: number;
    };
    recommendations: string[];
  };
}

// 默认WebSocket监控配置
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketMonitoringConfig = {
  heartbeatInterval: 30000, // 30秒
  connectionTimeout: 10000, // 10秒
  maxReconnectAttempts: 5,
  reconnectDelay: 3000, // 3秒
  enableAutoReconnect: true,
  enableQualityMonitoring: true,
  qualityCheckInterval: 5000, // 5秒
};

// 导出所有类型
export * from './index';
export * from './websocket';