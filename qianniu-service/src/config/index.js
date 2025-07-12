import 'dotenv/config';
import { ConfigManager } from './ConfigManager.js';

// 初始化配置管理器
let configManager;
let isConfigInitialized = false;

/**
 * 初始化配置管理器
 * @param {Object} options - 初始化选项
 * @returns {Promise<ConfigManager>}
 */
async function initializeConfig(options = {}) {
  if (!configManager) {
    configManager = ConfigManager.getInstance();
    
    try {
      await configManager.initialize({
        env: process.env.NODE_ENV || 'development',
        enableWatcher: process.env.NODE_ENV === 'development',
        ...options
      });
      isConfigInitialized = true;
      console.log('配置管理器初始化成功');
    } catch (error) {
      console.error('配置管理器初始化失败:', error.message);
      // 降级到传统配置模式
      isConfigInitialized = false;
    }
  }
  
  return configManager;
}

/**
 * 获取配置值
 * @param {string} path - 配置路径
 * @param {any} defaultValue - 默认值
 * @returns {any}
 */
function getConfig(path, defaultValue) {
  if (isConfigInitialized && configManager) {
    try {
      return configManager.get(path, defaultValue);
    } catch (error) {
      console.warn(`获取配置失败 ${path}:`, error.message);
    }
  }
  
  // 降级到环境变量或默认值
  return defaultValue;
}

/**
 * 检查配置是否存在
 * @param {string} path - 配置路径
 * @returns {boolean}
 */
function hasConfig(path) {
  if (isConfigInitialized && configManager) {
    try {
      return configManager.has(path);
    } catch (error) {
      console.warn(`检查配置失败 ${path}:`, error.message);
    }
  }
  
  return false;
}

// 向后兼容的配置对象
const legacyConfig = {
  port: process.env.PORT || 8080,
  wsPort: process.env.WS_PORT || 8081,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  
  // 新增配置获取方法
  get: getConfig,
  has: hasConfig,
  
  // 获取完整配置对象
  getAll() {
    if (isConfigInitialized && configManager) {
      try {
        return configManager.getAll();
      } catch (error) {
        console.warn('获取完整配置失败:', error.message);
      }
    }
    return this;
  },
  
  // 初始化方法
  async initialize(options) {
    return await initializeConfig(options);
  },
  
  // 获取配置管理器实例
  getManager() {
    return configManager;
  },
  
  // 检查是否已初始化
  isInitialized() {
    return isConfigInitialized;
  }
};

export default legacyConfig;