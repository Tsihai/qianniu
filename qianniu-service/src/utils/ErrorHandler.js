/**
 * 统一错误处理工具类
 * 提供自定义错误类型和统一的错误处理机制
 */

// 错误码常量定义
const ERROR_CODES = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  
  // WebSocket相关错误
  WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_MESSAGE_INVALID: 'WEBSOCKET_MESSAGE_INVALID',
  WEBSOCKET_CLIENT_NOT_FOUND: 'WEBSOCKET_CLIENT_NOT_FOUND',
  
  // 消息处理错误
  MESSAGE_PARSE_ERROR: 'MESSAGE_PARSE_ERROR',
  MESSAGE_PROCESSING_ERROR: 'MESSAGE_PROCESSING_ERROR',
  INTENT_CLASSIFICATION_ERROR: 'INTENT_CLASSIFICATION_ERROR',
  
  // 业务逻辑错误
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  AUTO_REPLY_ERROR: 'AUTO_REPLY_ERROR',
  SESSION_ERROR: 'SESSION_ERROR',
  
  // 配置错误
  CONFIG: {
    VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
    NOT_INITIALIZED: 'CONFIG_NOT_INITIALIZED',
    INITIALIZATION_FAILED: 'CONFIG_INITIALIZATION_FAILED',
    INVALID_FORMAT: 'CONFIG_INVALID_FORMAT',
    FILE_NOT_FOUND: 'CONFIG_FILE_NOT_FOUND',
    SCHEMA_ERROR: 'CONFIG_SCHEMA_ERROR',
    ENV_OVERRIDE_ERROR: 'CONFIG_ENV_OVERRIDE_ERROR'
  },
  
  // 向后兼容的配置错误码
  CONFIG_VALIDATION_ERROR: 'CONFIG_VALIDATION_FAILED',
  CONFIG_MISSING_ERROR: 'CONFIG_FILE_NOT_FOUND'
};

// 错误消息模板
const ERROR_MESSAGES = {
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误',
  [ERROR_CODES.INVALID_PARAMETER]: '参数无效: {parameter}',
  [ERROR_CODES.MISSING_PARAMETER]: '缺少必需参数: {parameter}',
  [ERROR_CODES.WEBSOCKET_CONNECTION_FAILED]: 'WebSocket连接失败: {reason}',
  [ERROR_CODES.WEBSOCKET_MESSAGE_INVALID]: 'WebSocket消息格式无效',
  [ERROR_CODES.WEBSOCKET_CLIENT_NOT_FOUND]: '客户端未找到: {clientId}',
  [ERROR_CODES.MESSAGE_PARSE_ERROR]: '消息解析失败: {reason}',
  [ERROR_CODES.MESSAGE_PROCESSING_ERROR]: '消息处理失败: {reason}',
  [ERROR_CODES.INTENT_CLASSIFICATION_ERROR]: '意图分类失败: {reason}',
  [ERROR_CODES.BUSINESS_LOGIC_ERROR]: '业务逻辑处理失败: {reason}',
  [ERROR_CODES.AUTO_REPLY_ERROR]: '自动回复失败: {reason}',
  [ERROR_CODES.SESSION_ERROR]: '会话处理失败: {reason}',
  [ERROR_CODES.CONFIG.VALIDATION_FAILED]: '配置验证失败: {details}',
  [ERROR_CODES.CONFIG.NOT_INITIALIZED]: '配置管理器未初始化',
  [ERROR_CODES.CONFIG.INITIALIZATION_FAILED]: '配置管理器初始化失败: {reason}',
  [ERROR_CODES.CONFIG.INVALID_FORMAT]: '配置文件格式无效: {file}',
  [ERROR_CODES.CONFIG.FILE_NOT_FOUND]: '配置文件未找到: {file}',
  [ERROR_CODES.CONFIG.SCHEMA_ERROR]: '配置Schema错误: {details}',
  [ERROR_CODES.CONFIG.ENV_OVERRIDE_ERROR]: '环境变量覆盖失败: {variable}',
  
  // 向后兼容的错误消息
  [ERROR_CODES.CONFIG_VALIDATION_ERROR]: '配置验证失败: {field}',
  [ERROR_CODES.CONFIG_MISSING_ERROR]: '配置项缺失: {field}'
};

/**
 * 自定义错误类
 */
class CustomError extends Error {
  constructor(code, message, details = {}, originalError = null) {
    // 格式化错误消息
    const formattedMessage = ErrorHandler.formatMessage(message, details);
    super(formattedMessage);
    
    this.name = 'CustomError';
    this.code = code;
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // 保持错误堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
  
  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * 获取用户友好的错误信息
   */
  getUserMessage() {
    return this.details.userMessage || this.message;
  }
}

/**
 * 错误处理工具类
 */
class ErrorHandler {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.context - 错误处理上下文
   * @param {boolean} options.enableLogging - 是否启用日志记录
   * @param {string} options.logLevel - 日志级别
   * @param {Object} options.configManager - 配置管理器
   */
  constructor(options = {}) {
    this.context = options.context || 'ErrorHandler';
    this.enableLogging = options.enableLogging !== false;
    this.logLevel = options.logLevel || 'error';
    this.configManager = options.configManager;
  }

  /**
   * 处理错误的实例方法
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   */
  handle(error, context = {}) {
    const wrappedError = ErrorHandler.wrapError(error, ERROR_CODES.UNKNOWN_ERROR, {
      ...context,
      handlerContext: this.context
    });

    if (this.enableLogging) {
      // 简单的控制台日志记录，如果有logger可以替换
      console.error(`[${this.context}] Error handled:`, {
        code: wrappedError.code,
        message: wrappedError.message,
        context: context,
        timestamp: wrappedError.timestamp
      });
    }

    return wrappedError;
  }
  /**
   * 创建自定义错误
   * @param {string} code - 错误码
   * @param {Object} details - 错误详情
   * @param {Error} originalError - 原始错误对象
   * @returns {CustomError}
   */
  static createError(code, details = {}, originalError = null) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
    return new CustomError(code, message, details, originalError);
  }
  
  /**
   * 格式化错误消息
   * @param {string} template - 消息模板
   * @param {Object} params - 参数对象
   * @returns {string}
   */
  static formatMessage(template, params = {}) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
  
  /**
   * 处理和包装原生错误
   * @param {Error} error - 原始错误
   * @param {string} code - 错误码
   * @param {Object} details - 额外详情
   * @returns {CustomError}
   */
  static wrapError(error, code = ERROR_CODES.UNKNOWN_ERROR, details = {}) {
    if (error instanceof CustomError) {
      return error;
    }
    
    return this.createError(code, {
      ...details,
      originalMessage: error.message
    }, error);
  }
  
  /**
   * 安全执行函数，自动捕获和处理错误
   * @param {Function} fn - 要执行的函数
   * @param {string} errorCode - 默认错误码
   * @param {Object} context - 上下文信息
   * @returns {Promise|any}
   */
  static safeExecute(fn, errorCode = ERROR_CODES.UNKNOWN_ERROR, context = {}) {
    try {
      const result = fn();
      
      // 处理Promise
      if (result && typeof result.then === 'function') {
        return result.catch(error => {
          throw this.wrapError(error, errorCode, context);
        });
      }
      
      return result;
    } catch (error) {
      throw this.wrapError(error, errorCode, context);
    }
  }
  
  /**
   * 异步安全执行
   * @param {Function} asyncFn - 异步函数
   * @param {string} errorCode - 错误码
   * @param {Object} context - 上下文
   * @returns {Promise}
   */
  static async safeExecuteAsync(asyncFn, errorCode = ERROR_CODES.UNKNOWN_ERROR, context = {}) {
    try {
      return await asyncFn();
    } catch (error) {
      throw this.wrapError(error, errorCode, context);
    }
  }
  
  /**
   * 判断是否为特定类型的错误
   * @param {Error} error - 错误对象
   * @param {string} code - 错误码
   * @returns {boolean}
   */
  static isErrorType(error, code) {
    return error instanceof CustomError && error.code === code;
  }
  
  /**
   * 获取错误的严重级别
   * @param {Error} error - 错误对象
   * @returns {string} - 'low', 'medium', 'high', 'critical'
   */
  static getErrorSeverity(error) {
    if (!(error instanceof CustomError)) {
      return 'medium';
    }
    
    const criticalCodes = [
      ERROR_CODES.WEBSOCKET_CONNECTION_FAILED,
      ERROR_CODES.CONFIG.INITIALIZATION_FAILED,
      ERROR_CODES.CONFIG.NOT_INITIALIZED,
      ERROR_CODES.CONFIG_MISSING_ERROR
    ];
    
    const highCodes = [
      ERROR_CODES.MESSAGE_PROCESSING_ERROR,
      ERROR_CODES.BUSINESS_LOGIC_ERROR,
      ERROR_CODES.SESSION_ERROR,
      ERROR_CODES.CONFIG.VALIDATION_FAILED,
      ERROR_CODES.CONFIG.INVALID_FORMAT,
      ERROR_CODES.CONFIG.SCHEMA_ERROR
    ];
    
    const lowCodes = [
      ERROR_CODES.INVALID_PARAMETER,
      ERROR_CODES.WEBSOCKET_MESSAGE_INVALID
    ];
    
    if (criticalCodes.includes(error.code)) return 'critical';
    if (highCodes.includes(error.code)) return 'high';
    if (lowCodes.includes(error.code)) return 'low';
    
    return 'medium';
  }
  
  /**
   * 创建错误响应对象
   * @param {Error} error - 错误对象
   * @param {boolean} includeStack - 是否包含堆栈信息
   * @returns {Object}
   */
  static createErrorResponse(error, includeStack = false) {
    const response = {
      success: false,
      error: {
        code: error.code || ERROR_CODES.UNKNOWN_ERROR,
        message: error.message,
        severity: this.getErrorSeverity(error),
        timestamp: new Date().toISOString()
      }
    };
    
    if (error instanceof CustomError) {
      response.error.details = error.details;
      if (includeStack) {
        response.error.stack = error.stack;
      }
    }
    
    return response;
  }
}

// 导出
export { ErrorHandler, CustomError, ERROR_CODES, ERROR_MESSAGES };
export default ErrorHandler;