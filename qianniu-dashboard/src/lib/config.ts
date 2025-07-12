/**
 * 环境配置管理
 * 根据不同环境提供相应的配置参数
 */

// 环境类型
export type Environment = 'development' | 'production' | 'test'

// 配置接口
export interface AppConfig {
  env: Environment
  apiUrl: string
  wsUrl: string
  enableDevTools: boolean
  enableMockData: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  version: string
  buildTime: string
}

// 获取当前环境
function getEnvironment(): Environment {
  if (typeof window === 'undefined') {
    return (process.env.NODE_ENV as Environment) || 'development'
  }
  return (process.env.NEXT_PUBLIC_ENV as Environment) || 'development'
}

// 开发环境配置
const developmentConfig: AppConfig = {
  env: 'development',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  enableDevTools: true,
  enableMockData: true,
  logLevel: 'debug',
  version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
}

// 生产环境配置
const productionConfig: AppConfig = {
  env: 'production',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.qianniu.com',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.qianniu.com/ws',
  enableDevTools: false,
  enableMockData: false,
  logLevel: 'error',
  version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
}

// 测试环境配置
const testConfig: AppConfig = {
  env: 'test',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://test-api.qianniu.com',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://test-api.qianniu.com/ws',
  enableDevTools: true,
  enableMockData: true,
  logLevel: 'info',
  version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
}

// 配置映射
const configs: Record<Environment, AppConfig> = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig
}

// 获取当前配置
export function getConfig(): AppConfig {
  const env = getEnvironment()
  return configs[env]
}

// 导出当前配置
export const config = getConfig()

// 配置验证
export function validateConfig(config: AppConfig): boolean {
  const requiredFields: (keyof AppConfig)[] = [
    'env',
    'apiUrl',
    'wsUrl',
    'version'
  ]

  for (const field of requiredFields) {
    if (!config[field]) {
      console.error(`配置验证失败: 缺少必需字段 ${field}`)
      return false
    }
  }

  // 验证URL格式
  try {
    new URL(config.apiUrl)
  } catch {
    console.error('配置验证失败: apiUrl 格式无效')
    return false
  }

  // 验证WebSocket URL格式
  if (!config.wsUrl.startsWith('ws://') && !config.wsUrl.startsWith('wss://')) {
    console.error('配置验证失败: wsUrl 必须以 ws:// 或 wss:// 开头')
    return false
  }

  return true
}

// 功能开关配置
export const featureFlags = {
  // 实时通知
  enableRealTimeNotifications: true,
  // 自动回复
  enableAutoReply: true,
  // 消息导出
  enableMessageExport: true,
  // 高级统计
  enableAdvancedStats: true,
  // 暗色主题
  enableDarkMode: true,
  // 多语言支持
  enableI18n: false,
  // 性能监控
  enablePerformanceMonitoring: config.env === 'production',
  // 错误追踪
  enableErrorTracking: config.env === 'production',
  // A/B测试
  enableABTesting: false,
} as const

// 性能配置
export const performanceConfig = {
  // 虚拟滚动阈值
  virtualScrollThreshold: 100,
  // 分页大小
  defaultPageSize: 20,
  // 搜索防抖延迟
  searchDebounceDelay: 300,
  // 自动保存间隔（毫秒）
  autoSaveInterval: 30000,
  // 缓存过期时间（毫秒）
  cacheExpiration: 300000, // 5分钟
  // 最大重试次数
  maxRetryAttempts: 3,
  // 请求超时时间（毫秒）
  requestTimeout: 10000,
} as const

// 安全配置
export const securityConfig = {
  // 会话超时时间（毫秒）
  sessionTimeout: 3600000, // 1小时
  // 密码最小长度
  minPasswordLength: 8,
  // 最大登录尝试次数
  maxLoginAttempts: 5,
  // 登录锁定时间（毫秒）
  loginLockoutDuration: 900000, // 15分钟
  // CSRF保护
  enableCSRFProtection: true,
  // XSS保护
  enableXSSProtection: true,
} as const

// UI配置
export const uiConfig = {
  // 侧边栏默认宽度
  sidebarWidth: 280,
  // 侧边栏最小宽度
  sidebarMinWidth: 200,
  // 侧边栏最大宽度
  sidebarMaxWidth: 400,
  // 头部高度
  headerHeight: 64,
  // 动画持续时间
  animationDuration: 200,
  // 通知显示时间（毫秒）
  notificationDuration: 5000,
  // 工具提示延迟（毫秒）
  tooltipDelay: 500,
} as const

// 日志配置
export const logConfig = {
  level: config.logLevel,
  enableConsole: config.env !== 'production',
  enableRemote: config.env === 'production',
  maxLogSize: 1000, // 最大日志条数
  logRetentionDays: 7, // 日志保留天数
} as const

// 导出所有配置
export {
  developmentConfig,
  productionConfig,
  testConfig
}

// 配置工具函数
export const configUtils = {
  /**
   * 检查是否为开发环境
   */
  isDevelopment: () => config.env === 'development',
  
  /**
   * 检查是否为生产环境
   */
  isProduction: () => config.env === 'production',
  
  /**
   * 检查是否为测试环境
   */
  isTest: () => config.env === 'test',
  
  /**
   * 检查功能是否启用
   */
  isFeatureEnabled: (feature: keyof typeof featureFlags) => {
    return featureFlags[feature]
  },
  
  /**
   * 获取API完整URL
   */
  getApiUrl: (endpoint: string) => {
    const baseUrl = config.apiUrl.endsWith('/') 
      ? config.apiUrl.slice(0, -1) 
      : config.apiUrl
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${baseUrl}${path}`
  },
  
  /**
   * 获取WebSocket完整URL
   */
  getWsUrl: (path?: string) => {
    if (!path) return config.wsUrl
    const baseUrl = config.wsUrl.endsWith('/') 
      ? config.wsUrl.slice(0, -1) 
      : config.wsUrl
    const wsPath = path.startsWith('/') ? path : `/${path}`
    return `${baseUrl}${wsPath}`
  }
}