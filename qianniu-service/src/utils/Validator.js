/**
 * 输入验证工具类
 * 提供链式调用的验证API和常用验证方法
 */

import { ErrorHandler, ERROR_CODES } from './ErrorHandler.js';

/**
 * 验证结果类
 */
class ValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
  }
  
  /**
   * 添加错误
   * @param {string} field - 字段名
   * @param {string} message - 错误消息
   * @param {string} code - 错误码
   */
  addError(field, message, code = 'VALIDATION_ERROR') {
    this.isValid = false;
    this.errors.push({ field, message, code });
  }
  
  /**
   * 添加警告
   * @param {string} field - 字段名
   * @param {string} message - 警告消息
   */
  addWarning(field, message) {
    this.warnings.push({ field, message });
  }
  
  /**
   * 获取第一个错误
   */
  getFirstError() {
    return this.errors.length > 0 ? this.errors[0] : null;
  }
  
  /**
   * 抛出验证错误
   */
  throwIfInvalid() {
    if (!this.isValid) {
      const firstError = this.getFirstError();
      throw ErrorHandler.createError(ERROR_CODES.INVALID_PARAMETER, {
        field: firstError.field,
        parameter: firstError.field,
        validationErrors: this.errors
      });
    }
  }
}

/**
 * 字段验证器类（支持链式调用）
 */
class FieldValidator {
  constructor(value, fieldName, result) {
    this.value = value;
    this.fieldName = fieldName;
    this.result = result;
    this.shouldContinue = true;
  }
  
  /**
   * 检查是否应该继续验证
   */
  _checkContinue() {
    if (!this.shouldContinue) {
      return false;
    }
    return true;
  }
  
  /**
   * 添加错误并停止后续验证
   */
  _addError(message, code) {
    this.result.addError(this.fieldName, message, code);
    this.shouldContinue = false;
    return this;
  }
  
  /**
   * 必填验证
   */
  required(message = `${this.fieldName} 是必填项`) {
    if (!this._checkContinue()) return this;
    
    if (this.value === null || this.value === undefined || this.value === '') {
      return this._addError(message, 'REQUIRED');
    }
    return this;
  }
  
  /**
   * 类型验证
   */
  type(expectedType, message) {
    if (!this._checkContinue()) return this;
    
    const actualType = typeof this.value;
    if (actualType !== expectedType) {
      const defaultMessage = `${this.fieldName} 应该是 ${expectedType} 类型，实际是 ${actualType}`;
      return this._addError(message || defaultMessage, 'INVALID_TYPE');
    }
    return this;
  }
  
  /**
   * 字符串验证
   */
  string(message) {
    return this.type('string', message);
  }
  
  /**
   * 数字验证
   */
  number(message) {
    return this.type('number', message);
  }
  
  /**
   * 布尔值验证
   */
  boolean(message) {
    return this.type('boolean', message);
  }
  
  /**
   * 对象验证
   */
  object(message) {
    if (!this._checkContinue()) return this;
    
    if (typeof this.value !== 'object' || this.value === null || Array.isArray(this.value)) {
      const defaultMessage = `${this.fieldName} 应该是对象类型`;
      return this._addError(message || defaultMessage, 'INVALID_TYPE');
    }
    return this;
  }
  
  /**
   * 数组验证
   */
  array(message) {
    if (!this._checkContinue()) return this;
    
    if (!Array.isArray(this.value)) {
      const defaultMessage = `${this.fieldName} 应该是数组类型`;
      return this._addError(message || defaultMessage, 'INVALID_TYPE');
    }
    return this;
  }
  
  /**
   * 最小长度验证
   */
  minLength(min, message) {
    if (!this._checkContinue()) return this;
    
    const length = this.value ? this.value.length : 0;
    if (length < min) {
      const defaultMessage = `${this.fieldName} 长度不能少于 ${min} 个字符`;
      return this._addError(message || defaultMessage, 'MIN_LENGTH');
    }
    return this;
  }
  
  /**
   * 最大长度验证
   */
  maxLength(max, message) {
    if (!this._checkContinue()) return this;
    
    const length = this.value ? this.value.length : 0;
    if (length > max) {
      const defaultMessage = `${this.fieldName} 长度不能超过 ${max} 个字符`;
      return this._addError(message || defaultMessage, 'MAX_LENGTH');
    }
    return this;
  }
  
  /**
   * 最小值验证
   */
  min(min, message) {
    if (!this._checkContinue()) return this;
    
    if (typeof this.value === 'number' && this.value < min) {
      const defaultMessage = `${this.fieldName} 不能小于 ${min}`;
      return this._addError(message || defaultMessage, 'MIN_VALUE');
    }
    return this;
  }
  
  /**
   * 最大值验证
   */
  max(max, message) {
    if (!this._checkContinue()) return this;
    
    if (typeof this.value === 'number' && this.value > max) {
      const defaultMessage = `${this.fieldName} 不能大于 ${max}`;
      return this._addError(message || defaultMessage, 'MAX_VALUE');
    }
    return this;
  }
  
  /**
   * 正则表达式验证
   */
  pattern(regex, message) {
    if (!this._checkContinue()) return this;
    
    if (typeof this.value === 'string' && !regex.test(this.value)) {
      const defaultMessage = `${this.fieldName} 格式不正确`;
      return this._addError(message || defaultMessage, 'INVALID_FORMAT');
    }
    return this;
  }
  
  /**
   * 邮箱验证
   */
  email(message) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const defaultMessage = `${this.fieldName} 邮箱格式不正确`;
    return this.pattern(emailRegex, message || defaultMessage);
  }
  
  /**
   * URL验证
   */
  url(message) {
    if (!this._checkContinue()) return this;
    
    try {
      new URL(this.value);
    } catch {
      const defaultMessage = `${this.fieldName} URL格式不正确`;
      return this._addError(message || defaultMessage, 'INVALID_URL');
    }
    return this;
  }
  
  /**
   * 枚举值验证
   */
  enum(allowedValues, message) {
    if (!this._checkContinue()) return this;
    
    if (!allowedValues.includes(this.value)) {
      const defaultMessage = `${this.fieldName} 必须是以下值之一: ${allowedValues.join(', ')}`;
      return this._addError(message || defaultMessage, 'INVALID_ENUM');
    }
    return this;
  }
  
  /**
   * 自定义验证函数
   */
  custom(validatorFn, message) {
    if (!this._checkContinue()) return this;
    
    try {
      const isValid = validatorFn(this.value);
      if (!isValid) {
        const defaultMessage = `${this.fieldName} 验证失败`;
        return this._addError(message || defaultMessage, 'CUSTOM_VALIDATION');
      }
    } catch (error) {
      const defaultMessage = `${this.fieldName} 自定义验证出错: ${error.message}`;
      return this._addError(message || defaultMessage, 'CUSTOM_VALIDATION_ERROR');
    }
    return this;
  }
  
  /**
   * 条件验证
   */
  when(condition, validatorFn) {
    if (!this._checkContinue()) return this;
    
    if (condition) {
      validatorFn(this);
    }
    return this;
  }
}

/**
 * 主验证器类
 */
class Validator {
  constructor() {
    this.result = new ValidationResult();
  }
  
  /**
   * 验证字段
   * @param {any} value - 要验证的值
   * @param {string} fieldName - 字段名
   * @returns {FieldValidator}
   */
  field(value, fieldName) {
    return new FieldValidator(value, fieldName, this.result);
  }
  
  /**
   * 批量验证对象
   * @param {Object} data - 要验证的数据对象
   * @param {Object} rules - 验证规则
   * @returns {ValidationResult}
   */
  validate(data, rules) {
    for (const [fieldName, rule] of Object.entries(rules)) {
      const value = data[fieldName];
      const fieldValidator = this.field(value, fieldName);
      
      // 执行验证规则
      if (typeof rule === 'function') {
        rule(fieldValidator);
      } else if (Array.isArray(rule)) {
        // 支持规则数组
        rule.forEach(r => r(fieldValidator));
      }
    }
    
    return this.result;
  }
  
  /**
   * 获取验证结果
   */
  getResult() {
    return this.result;
  }
  
  /**
   * 重置验证器
   */
  reset() {
    this.result = new ValidationResult();
    return this;
  }
  
  /**
   * 静态方法：快速验证
   * @param {Object} data - 数据
   * @param {Object} rules - 规则
   * @returns {ValidationResult}
   */
  static validate(data, rules) {
    const validator = new Validator();
    return validator.validate(data, rules);
  }
  
  /**
   * 静态方法：验证并抛出错误
   * @param {Object} data - 数据
   * @param {Object} rules - 规则
   */
  static validateAndThrow(data, rules) {
    const result = this.validate(data, rules);
    result.throwIfInvalid();
  }
  
  /**
   * 常用验证规则
   */
  static rules = {
    required: (validator) => validator.required(),
    string: (validator) => validator.string(),
    number: (validator) => validator.number(),
    boolean: (validator) => validator.boolean(),
    array: (validator) => validator.array(),
    object: (validator) => validator.object(),
    email: (validator) => validator.email(),
    url: (validator) => validator.url(),
    
    // 组合规则
    requiredString: (validator) => validator.required().string(),
    requiredNumber: (validator) => validator.required().number(),
    requiredArray: (validator) => validator.required().array(),
    requiredObject: (validator) => validator.required().object(),
    
    // 工厂函数
    minLength: (min) => (validator) => validator.minLength(min),
    maxLength: (max) => (validator) => validator.maxLength(max),
    min: (min) => (validator) => validator.min(min),
    max: (max) => (validator) => validator.max(max),
    pattern: (regex) => (validator) => validator.pattern(regex),
    enum: (values) => (validator) => validator.enum(values),
    custom: (fn, message) => (validator) => validator.custom(fn, message)
  };
}

// 导出
export {
  Validator,
  ValidationResult,
  FieldValidator
};

export default Validator;