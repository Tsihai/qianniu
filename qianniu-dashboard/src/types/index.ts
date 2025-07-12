// Real-time metrics types
export interface MetricsConfig {
  /** 滑动窗口时间间隔配置 */
  windowSizes: {
    /** 1分钟窗口大小（毫秒） */
    oneMinute: number;
    /** 5分钟窗口大小（毫秒） */
    fiveMinutes: number;
    /** 60分钟窗口大小（毫秒） */
    sixtyMinutes: number;
  };
  /** 数据采样间隔（毫秒） */
  sampleInterval: number;
  /** 是否启用本地存储持久化 */
  enablePersistence: boolean;
  /** 本地存储键名前缀 */
  storageKeyPrefix: string;
  /** 最大内存中保存的数据点数量 */
  maxDataPoints: number;
}

export interface MetricsData {
  /** 消息处理速率（条/分钟） */
  messageProcessingRate: {
    oneMinute: number;
    fiveMinutes: number;
    sixtyMinutes: number;
  };
  /** 平均响应时间（毫秒） */
  averageResponseTime: {
    oneMinute: number;
    fiveMinutes: number;
    sixtyMinutes: number;
  };
  /** 错误率（百分比） */
  errorRate: {
    oneMinute: number;
    fiveMinutes: number;
    sixtyMinutes: number;
  };
  /** 连接稳定性（百分比） */
  connectionStability: {
    oneMinute: number;
    fiveMinutes: number;
    sixtyMinutes: number;
  };
  /** 客服工作负载 */
  agentWorkload: {
    oneMinute: number;
    fiveMinutes: number;
    sixtyMinutes: number;
  };
  /** 最后更新时间戳 */
  lastUpdated: number;
}

export interface SlidingWindowConfig {
  /** 窗口大小（毫秒） */
  windowSize: number;
  /** 最大数据点数量 */
  maxDataPoints?: number;
  /** 是否启用数据压缩 */
  enableCompression?: boolean;
  /** 压缩比例 */
  compressionRatio?: number;
}

export interface MetricsCalculator {
  /** 添加数据点到滑动窗口 */
  addDataPoint: (timestamp: number, value: number) => void;
  /** 获取指定时间窗口内的统计数据 */
  getWindowStats: (windowSize: number) => {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
  };
  /** 清理过期数据点 */
  cleanup: (currentTime: number) => void;
  /** 获取所有数据点 */
  getAllDataPoints: () => SlidingWindowConfig[];
}

// 导入WebSocket类型定义
export * from './websocket'

// 通用消息类型
export interface Message {
  id: string
  content: string
  timestamp: number
  type: 'user' | 'agent' | 'system'
  status?: 'pending' | 'sent' | 'delivered' | 'read'
  priority?: 'low' | 'medium' | 'high'
  category?: 'inquiry' | 'complaint' | 'support' | 'other'
  customerName?: string
  customerId?: string
  assignedTo?: string
  responseTime?: number
}

// 通知类型
export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: number
  read: boolean
  actionUrl?: string
}

// 客服消息类型
export interface CustomerMessage {
  id: string
  customerId: string
  customerName: string
  content: string
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'auto_replied'
  assignedTo?: string
  priority: 'low' | 'medium' | 'high'
  category: 'inquiry' | 'complaint' | 'support' | 'other'
}

// 自动化规则类型
export interface AutomationRule {
  id: string
  name: string
  description: string
  keywords: string[]
  response: string
  isEnabled: boolean
  triggerCount: number
  successRate: number
  createdAt: number
  updatedAt: number
  conditions: RuleCondition[]
  actions: RuleAction[]
}

// 规则条件
export interface RuleCondition {
  type: 'keyword' | 'time' | 'customer_type' | 'message_count'
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'between'
  value: string | number
  caseSensitive?: boolean
}

// 规则动作
export interface RuleAction {
  type: 'auto_reply' | 'assign_agent' | 'escalate' | 'tag' | 'notify'
  value: string
  delay?: number
}

// 客服代理类型
export interface Agent {
  id: string
  name: string
  email: string
  status: 'online' | 'offline' | 'busy' | 'away'
  currentLoad: number
  maxLoad: number
  totalMessages: number
  avgResponseTime: number
  satisfactionRating: number
  lastActive: number
}

// 系统统计类型
export interface SystemStats {
  totalMessages: number
  pendingMessages: number
  processedMessages: number
  autoRepliedMessages: number
  avgResponseTime: number
  automationRate: number
  onlineAgents: number
  customerSatisfaction: number
}

// 分析数据类型
export interface AnalyticsData {
  period: 'hour' | 'day' | 'week' | 'month'
  messageVolume: TimeSeriesData[]
  responseTime: TimeSeriesData[]
  automationRate: TimeSeriesData[]
  customerSatisfaction: TimeSeriesData[]
  messageTypes: CategoryData[]
  agentPerformance: AgentPerformanceData[]
}

// 时间序列数据
export interface TimeSeriesData {
  timestamp: number
  value: number
  label?: string
}

// 分类数据
export interface CategoryData {
  category: string
  value: number
  percentage: number
  color?: string
}

// 客服绩效数据
export interface AgentPerformanceData {
  agentId: string
  agentName: string
  messagesHandled: number
  avgResponseTime: number
  satisfactionRating: number
  automationUsage: number
}

// 系统设置类型
export interface SystemSettings {
  websocket: {
    url: string
    timeout: number
    reconnectInterval: number
    maxReconnectAttempts: number
  }
  notifications: {
    newMessage: boolean
    systemError: boolean
    ruleTriggered: boolean
    email: string
  }
  security: {
    enableAccessLog: boolean
    enableIpWhitelist: boolean
    sessionTimeout: number
    apiKey: string
  }
  general: {
    theme: 'light' | 'dark' | 'system'
    language: 'zh-CN' | 'en-US'
    timezone: string
  }
}

// 用户类型
export interface User {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'admin' | 'agent' | 'viewer'
  permissions: string[]
  isActive: boolean
  lastLogin: number
  createdAt: number
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: number
  timestamp?: number
}

// API错误接口
export interface ApiError {
  message: string
  code?: number
  details?: any
}

// 请求配置接口
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
}

// 分页请求参数
export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 分页类型
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 过滤器类型
export interface MessageFilter {
  status?: CustomerMessage['status'][]
  category?: CustomerMessage['category'][]
  priority?: CustomerMessage['priority'][]
  assignedTo?: string[]
  dateRange?: {
    start: number
    end: number
  }
  keyword?: string
}

// 排序类型
export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}

// 导出类型
export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf'
  dateRange: {
    start: number
    end: number
  }
  includeFields: string[]
  filters?: MessageFilter
}