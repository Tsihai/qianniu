/**
 * 系统常量配置
 * 定义应用程序中使用的各种常量
 */

// WebSocket配置
export const WEBSOCKET_CONFIG = {
  URL: 'ws://localhost:8080/ws',
  RECONNECT_INTERVAL: 3000, // 3秒
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000, // 30秒
  CONNECTION_TIMEOUT: 10000, // 10秒
} as const

// API配置
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  TIMEOUT: 10000, // 10秒
  RETRY_ATTEMPTS: 3,
} as const

// 本地存储键名
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user-preferences',
  THEME: 'theme',
  SIDEBAR_STATE: 'sidebar-collapsed',
  DASHBOARD_LAYOUT: 'dashboard-layout',
  MESSAGE_FILTERS: 'message-filters',
  RULE_FILTERS: 'rule-filters',
  // 实时指标相关存储键
  METRICS_DATA: 'metrics-data',
  METRICS_CONFIG: 'metrics-config',
  METRICS_CACHE: 'metrics-cache',
} as const

// 主题配置
export const THEME_CONFIG = {
  DEFAULT: 'system',
  STORAGE_KEY: 'theme',
  ATTRIBUTE: 'class',
} as const

// 分页配置
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const

// 消息状态
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  AUTO_REPLIED: 'auto_replied',
} as const

// 消息优先级
export const MESSAGE_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

// 消息类别
export const MESSAGE_CATEGORY = {
  INQUIRY: 'inquiry',
  COMPLAINT: 'complaint',
  SUPPORT: 'support',
  OTHER: 'other',
} as const

// 规则条件类型
export const RULE_CONDITION_TYPE = {
  KEYWORD: 'keyword',
  TIME: 'time',
  CUSTOMER_TYPE: 'customer_type',
  MESSAGE_COUNT: 'message_count',
} as const

// 规则条件操作符
export const RULE_CONDITION_OPERATOR = {
  CONTAINS: 'contains',
  EQUALS: 'equals',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  BETWEEN: 'between',
} as const

// 规则动作类型
export const RULE_ACTION_TYPE = {
  AUTO_REPLY: 'auto_reply',
  ASSIGN_AGENT: 'assign_agent',
  ESCALATE: 'escalate',
  TAG: 'tag',
  NOTIFY: 'notify',
} as const

// 用户角色
export const USER_ROLE = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  AGENT: 'agent',
  VIEWER: 'viewer',
} as const

// 客服状态
export const AGENT_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  AWAY: 'away',
} as const

// WebSocket消息类型
export const WS_MESSAGE_TYPE = {
  MESSAGE: 'message',
  STATUS: 'status',
  NOTIFICATION: 'notification',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
} as const

// 通知类型
export const NOTIFICATION_TYPE = {
  NEW_MESSAGE: 'new_message',
  SYSTEM_ERROR: 'system_error',
  RULE_TRIGGERED: 'rule_triggered',
  AGENT_STATUS_CHANGE: 'agent_status_change',
} as const

// 导出格式
export const EXPORT_FORMAT = {
  CSV: 'csv',
  XLSX: 'xlsx',
  PDF: 'pdf',
} as const

// 时间范围选项
export const TIME_RANGE_OPTIONS = [
  { label: '最近1小时', value: 'last_hour' },
  { label: '最近24小时', value: 'last_24_hours' },
  { label: '最近7天', value: 'last_7_days' },
  { label: '最近30天', value: 'last_30_days' },
  { label: '自定义', value: 'custom' },
] as const

// 刷新间隔选项（毫秒）
export const REFRESH_INTERVAL_OPTIONS = [
  { label: '5秒', value: 5000 },
  { label: '10秒', value: 10000 },
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 },
  { label: '关闭', value: 0 },
] as const

// 图表颜色配置
export const CHART_COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#6366f1',
  SECONDARY: '#6b7280',
} as const

// 响应式断点
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const

// 动画配置
export const ANIMATION_CONFIG = {
  DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  EASING: {
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out',
  },
} as const

// 错误消息
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误，请检查网络设置',
  WEBSOCKET_ERROR: 'WebSocket连接失败，正在尝试重连...',
  AUTH_ERROR: '身份验证失败，请重新登录',
  PERMISSION_ERROR: '权限不足，无法执行此操作',
  VALIDATION_ERROR: '数据验证失败，请检查输入内容',
  SERVER_ERROR: '服务器错误，请稍后重试',
  UNKNOWN_ERROR: '未知错误，请联系系统管理员',
} as const

// 成功消息
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
  CONNECT_SUCCESS: '连接成功',
  EXPORT_SUCCESS: '导出成功',
  IMPORT_SUCCESS: '导入成功',
} as const

// 确认消息
export const CONFIRM_MESSAGES = {
  DELETE_CONFIRM: '确定要删除这条记录吗？此操作不可撤销。',
  RESET_CONFIRM: '确定要重置设置吗？所有自定义配置将丢失。',
  LOGOUT_CONFIRM: '确定要退出登录吗？',
  CLEAR_DATA_CONFIRM: '确定要清空所有数据吗？此操作不可撤销。',
} as const

// 实时指标配置
export const METRICS_CONFIG = {
  // 时间窗口配置（毫秒）
  WINDOW_SIZES: {
    ONE_MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    SIXTY_MINUTES: 60 * 60 * 1000,
  },
  // 数据采样间隔（毫秒）
  SAMPLE_INTERVAL: 5000, // 5秒
  // 计算间隔（毫秒）
  CALCULATION_INTERVAL: 1000, // 1秒
  // 最大数据点数量
  MAX_DATA_POINTS: 3600, // 1小时的数据点（每秒一个）
  // 存储键名前缀
  STORAGE_KEY_PREFIX: 'qianniu-metrics',
  // 默认启用持久化
  DEFAULT_PERSISTENCE: true,
} as const

// 指标类型枚举
export const METRICS_TYPE = {
  MESSAGE_PROCESSING_RATE: 'message_processing_rate',
  MESSAGE_RATE: 'message_rate',
  AVERAGE_RESPONSE_TIME: 'average_response_time',
  RESPONSE_TIME: 'response_time',
  ERROR_RATE: 'error_rate',
  CONNECTION_STABILITY: 'connection_stability',
  AGENT_WORKLOAD: 'agent_workload',
  SYSTEM_PERFORMANCE: 'system_performance',
} as const

// 指标计算相关常量
export const METRICS_CALCULATION = {
  // 最小计算间隔（毫秒）
  MIN_INTERVAL: 1000,
  // 最大计算间隔（毫秒）
  MAX_INTERVAL: 60000,
  // 数据清理间隔（毫秒）
  CLEANUP_INTERVAL: 300000, // 5分钟
  // 内存使用阈值（数据点数量）
  MEMORY_THRESHOLD: 10000,
  // 批处理大小
  BATCH_SIZE: 100,
} as const

// 指标阈值配置
export const METRICS_THRESHOLDS = {
  // 消息处理速率阈值（条/分钟）
  MESSAGE_RATE: {
    WARNING: 50,
    CRITICAL: 100,
  },
  // 响应时间阈值（毫秒）
  RESPONSE_TIME: {
    GOOD: 1000,
    WARNING: 3000,
    CRITICAL: 5000,
  },
  // 错误率阈值（百分比）
  ERROR_RATE: {
    GOOD: 1,
    WARNING: 5,
    CRITICAL: 10,
  },
  // 连接稳定性阈值（百分比）
  CONNECTION_STABILITY: {
    GOOD: 95,
    WARNING: 90,
    CRITICAL: 85,
  },
  // 工作负载阈值（消息数/分钟）
  WORKLOAD: {
    LOW: 10,
    MEDIUM: 30,
    HIGH: 50,
  },
  // 客服工作负载阈值（百分比）
  AGENT_WORKLOAD: {
    WARNING: 70,
    CRITICAL: 90,
  },
  // 系统性能阈值（百分比）
  SYSTEM_PERFORMANCE: {
    WARNING: 80,
    CRITICAL: 95,
  },
} as const

// 指标状态
export const METRICS_STATUS = {
  GOOD: 'good',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
} as const