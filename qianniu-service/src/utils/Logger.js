/**
 * 结构化日志系统
 * 提供统一的日志记录功能，支持不同级别、格式化输出和日志轮转
 */

import fs from 'fs';
import path from 'path';
import { ErrorHandler } from './ErrorHandler.js';

// 日志级别定义
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// 日志级别名称
const LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL'
};

// 日志颜色（用于控制台输出）
const LEVEL_COLORS = {
  [LOG_LEVELS.DEBUG]: '\x1b[36m', // 青色
  [LOG_LEVELS.INFO]: '\x1b[32m',  // 绿色
  [LOG_LEVELS.WARN]: '\x1b[33m',  // 黄色
  [LOG_LEVELS.ERROR]: '\x1b[31m', // 红色
  [LOG_LEVELS.FATAL]: '\x1b[35m'  // 紫色
};

const RESET_COLOR = '\x1b[0m';

/**
 * 日志格式化器
 */
class LogFormatter {
  /**
   * 格式化为JSON格式
   */
  static formatJSON(logEntry) {
    return JSON.stringify(logEntry);
  }
  
  /**
   * 格式化为可读格式
   */
  static formatReadable(logEntry, useColors = false) {
    const { timestamp, level, module, message, requestId, data, error } = logEntry;
    const levelName = LEVEL_NAMES[level];
    const color = useColors ? LEVEL_COLORS[level] : '';
    const resetColor = useColors ? RESET_COLOR : '';
    
    let formatted = `${color}[${timestamp}] ${levelName}${resetColor}`;
    
    if (module) {
      formatted += ` [${module}]`;
    }
    
    if (requestId) {
      formatted += ` [${requestId}]`;
    }
    
    formatted += ` ${message}`;
    
    if (data && Object.keys(data).length > 0) {
      formatted += ` | Data: ${JSON.stringify(data)}`;
    }
    
    if (error) {
      formatted += ` | Error: ${error.stack || error.message || error}`;
    }
    
    return formatted;
  }
  
  /**
   * 格式化为简单格式（兼容现有console.log）
   */
  static formatSimple(logEntry) {
    const { level, module, message, data } = logEntry;
    const levelName = LEVEL_NAMES[level];
    
    let formatted = `[${levelName}]`;
    
    if (module) {
      formatted += ` ${module}:`;
    }
    
    formatted += ` ${message}`;
    
    if (data && Object.keys(data).length > 0) {
      formatted += ` ${JSON.stringify(data)}`;
    }
    
    return formatted;
  }
}

/**
 * 日志轮转管理器
 */
class LogRotator {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.checkInterval = options.checkInterval || 60000; // 1分钟
    this.lastCheck = 0;
  }
  
  /**
   * 检查是否需要轮转
   */
  shouldRotate(filePath) {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return false;
    }
    
    this.lastCheck = now;
    
    try {
      const stats = fs.statSync(filePath);
      return stats.size >= this.maxFileSize;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 执行日志轮转
   */
  rotate(filePath) {
    try {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      
      // 移动现有文件
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${basename}.${i}${ext}`);
        const newFile = path.join(dir, `${basename}.${i + 1}${ext}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // 删除最老的文件
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // 移动当前文件
      const rotatedFile = path.join(dir, `${basename}.1${ext}`);
      fs.renameSync(filePath, rotatedFile);
      
      return true;
    } catch (error) {
      console.error('Log rotation failed:', error);
      return false;
    }
  }
}

/**
 * 日志输出器基类
 */
class LogAppender {
  constructor(options = {}) {
    this.level = options.level || LOG_LEVELS.INFO;
    this.formatter = options.formatter || LogFormatter.formatReadable;
  }
  
  shouldLog(level) {
    return level >= this.level;
  }
  
  append(logEntry) {
    throw new Error('append method must be implemented');
  }
}

/**
 * 控制台输出器
 */
class ConsoleAppender extends LogAppender {
  constructor(options = {}) {
    super(options);
    this.useColors = options.useColors !== false; // 默认使用颜色
  }
  
  append(logEntry) {
    if (!this.shouldLog(logEntry.level)) return;
    
    const formatted = LogFormatter.formatReadable(logEntry, this.useColors);
    
    if (logEntry.level >= LOG_LEVELS.ERROR) {
      console.error(formatted);
    } else if (logEntry.level >= LOG_LEVELS.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

/**
 * 文件输出器
 */
class FileAppender extends LogAppender {
  constructor(options = {}) {
    super(options);
    this.filePath = options.filePath;
    this.rotator = new LogRotator(options.rotation || {});
    this.formatter = options.formatter || LogFormatter.formatJSON;
    
    if (!this.filePath) {
      throw new Error('filePath is required for FileAppender');
    }
    
    // 确保目录存在
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  append(logEntry) {
    if (!this.shouldLog(logEntry.level)) return;
    
    try {
      // 检查是否需要轮转
      if (this.rotator.shouldRotate(this.filePath)) {
        this.rotator.rotate(this.filePath);
      }
      
      const formatted = this.formatter(logEntry);
      fs.appendFileSync(this.filePath, formatted + '\n');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }
}

/**
 * 主日志器类
 */
class Logger {
  constructor(options = {}) {
    // 保存ConfigManager实例
    this.configManager = options.configManager;
    
    this.module = options.module || options.context || 'default';
    this.level = this.getLevelFromString(this.configManager ? this.configManager.get('logging.level', 'info') : (options.level || 'info'));
    this.appenders = [];
    this.context = {};
    
    // 默认添加控制台输出器
    const enableConsole = this.configManager ? this.configManager.get('logging.enableConsole', true) : (options.enableConsole !== false && options.console !== false);
    if (enableConsole) {
      this.addAppender(new ConsoleAppender({
        level: this.level,
        useColors: this.configManager ? this.configManager.get('logging.useColors', true) : (options.useColors !== false)
      }));
    }
    
    // 添加文件输出器
    const enableFile = this.configManager ? this.configManager.get('logging.enableFile', false) : (options.enableFile || options.file);
    if (enableFile) {
      const filePath = this.configManager ? this.configManager.get('logging.filePath', './logs/app.log') : (options.filePath || options.file?.path || './logs/app.log');
      this.addAppender(new FileAppender({
        level: this.level,
        filePath: filePath,
        formatter: this.configManager ? 
          (this.configManager.get('logging.fileFormat', 'json') === 'readable' ? LogFormatter.formatReadable : LogFormatter.formatJSON) :
          (options.file?.format === 'readable' ? LogFormatter.formatReadable : LogFormatter.formatJSON),
        rotation: this.configManager ? {
          maxFileSize: this.configManager.get('logging.maxFileSize', 10 * 1024 * 1024),
          maxFiles: this.configManager.get('logging.maxFiles', 5)
        } : (options.file?.rotation || {})
      }));
    }
  }
  
  /**
   * 将字符串级别转换为数字级别
   */
  getLevelFromString(levelStr) {
    if (typeof levelStr === 'number') return levelStr;
    
    const upperLevel = levelStr.toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }
  
  /**
   * 添加输出器
   */
  addAppender(appender) {
    this.appenders.push(appender);
  }
  
  /**
   * 设置上下文信息
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * 清除上下文
   */
  clearContext() {
    this.context = {};
  }
  
  /**
   * 创建日志条目
   */
  createLogEntry(level, message, data = {}, error = null) {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      data: { ...this.context.data, ...data },
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null
    };
  }
  
  /**
   * 记录日志
   */
  log(level, message, data, error) {
    if (level < this.level) return;
    
    const logEntry = this.createLogEntry(level, message, data, error);
    
    this.appenders.forEach(appender => {
      try {
        appender.append(logEntry);
      } catch (err) {
        console.error('Appender error:', err);
      }
    });
  }
  
  /**
   * Debug级别日志
   */
  debug(message, data) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }
  
  /**
   * Info级别日志
   */
  info(message, data) {
    this.log(LOG_LEVELS.INFO, message, data);
  }
  
  /**
   * Warn级别日志
   */
  warn(message, data) {
    this.log(LOG_LEVELS.WARN, message, data);
  }
  
  /**
   * Error级别日志
   */
  error(message, data, error) {
    this.log(LOG_LEVELS.ERROR, message, data, error);
  }
  
  /**
   * Fatal级别日志
   */
  fatal(message, data, error) {
    this.log(LOG_LEVELS.FATAL, message, data, error);
  }
  
  /**
   * 创建子日志器
   */
  child(options = {}) {
    const childLogger = new Logger({
      module: options.module || this.module,
      level: options.level || this.level,
      console: false // 子日志器不添加默认控制台输出器
    });
    
    // 复制父日志器的输出器
    this.appenders.forEach(appender => {
      childLogger.addAppender(appender);
    });
    
    // 继承上下文
    childLogger.setContext({ ...this.context, ...options.context });
    
    return childLogger;
  }
  
  /**
   * 兼容现有console.log的方法
   */
  console(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    this.info(message);
  }
}

/**
 * 日志管理器（单例）
 */
class LoggerManager {
  constructor() {
    this.loggers = new Map();
    this.defaultConfig = {
      level: LOG_LEVELS.INFO,
      console: true,
      useColors: true
    };
  }
  
  /**
   * 设置默认配置
   */
  setDefaultConfig(config) {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
  
  /**
   * 获取日志器
   */
  getLogger(module, config = {}) {
    if (!this.loggers.has(module)) {
      const loggerConfig = { ...this.defaultConfig, ...config, module };
      this.loggers.set(module, new Logger(loggerConfig));
    }
    
    return this.loggers.get(module);
  }
  
  /**
   * 设置全局日志级别
   */
  setGlobalLevel(level) {
    this.defaultConfig.level = level;
    this.loggers.forEach(logger => {
      logger.level = level;
    });
  }
  
  /**
   * 清除所有日志器
   */
  clear() {
    this.loggers.clear();
  }
}

// 创建全局日志管理器实例
const loggerManager = new LoggerManager();

// 根据环境设置默认配置
if (process.env.NODE_ENV === 'production') {
  loggerManager.setDefaultConfig({
    level: LOG_LEVELS.INFO,
    useColors: false,
    file: {
      path: path.join(process.cwd(), 'logs', 'app.log'),
      format: 'json',
      rotation: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10
      }
    }
  });
} else if (process.env.NODE_ENV === 'development') {
  loggerManager.setDefaultConfig({
    level: LOG_LEVELS.DEBUG,
    useColors: true
  });
}

// 导出
export {
  Logger,
  LoggerManager,
  LogFormatter,
  ConsoleAppender,
  FileAppender,
  LOG_LEVELS,
  LEVEL_NAMES
};

// 便捷方法
export const getLogger = (module, config) => loggerManager.getLogger(module, config);
export const setGlobalLevel = (level) => loggerManager.setGlobalLevel(level);
export const setDefaultConfig = (config) => loggerManager.setDefaultConfig(config);

export default Logger;