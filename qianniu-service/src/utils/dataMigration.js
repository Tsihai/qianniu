/**
 * 数据迁移工具
 * 支持从JSON文件和MongoDB迁移数据到SQLite
 * 包含数据验证、进度监控、错误恢复功能
 */

import { promises as fs } from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { SQLiteConnectionManager } from '../config/sqliteConnection.js';
import { ErrorHandler } from './ErrorHandler.js';
import { getLogger } from './Logger.js';
import SQLiteSchemaManager from '../config/sqliteSchema.js';

// 迁移错误码
const MIGRATION_ERROR_CODES = {
  FILE_NOT_FOUND: 'MIGRATION_FILE_NOT_FOUND',
  INVALID_DATA: 'MIGRATION_INVALID_DATA',
  CONNECTION_FAILED: 'MIGRATION_CONNECTION_FAILED',
  VALIDATION_FAILED: 'MIGRATION_VALIDATION_FAILED',
  OPERATION_FAILED: 'MIGRATION_OPERATION_FAILED',
  ROLLBACK_FAILED: 'MIGRATION_ROLLBACK_FAILED'
};

class DataMigrationTool {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 100,
      enableValidation: options.enableValidation !== false,
      enableProgressMonitoring: options.enableProgressMonitoring !== false,
      enableErrorRecovery: options.enableErrorRecovery !== false,
      backupBeforeMigration: options.backupBeforeMigration !== false,
      ...options
    };
    
    this.logger = getLogger('DataMigrationTool');
    this.connectionManager = new SQLiteConnectionManager(options.configManager);
    this.schemaManager = new SQLiteSchemaManager();
    
    // 进度监控
    this.progress = {
      total: 0,
      processed: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
    
    // 错误记录
    this.errors = [];
    
    // 数据映射配置
    this.dataMappings = {
      customers: this.getCustomerMapping(),
      sessions: this.getSessionMapping(),
      messages: this.getMessageMapping(),
      intent_templates: this.getIntentTemplateMapping()
    };
  }

  /**
   * 初始化迁移工具
   */
  async initialize() {
    try {
      await this.connectionManager.initialize();
      this.log('数据迁移工具初始化完成');
    } catch (error) {
      throw ErrorHandler.wrapError(error, MIGRATION_ERROR_CODES.OPERATION_FAILED, {
        operation: 'initialize'
      });
    }
  }

  /**
   * 从JSON文件迁移数据
   * @param {string} filePath - JSON文件路径
   * @param {string} dataType - 数据类型 (customers, sessions, messages, intent_templates)
   * @param {Object} options - 迁移选项
   */
  async migrateFromJSON(filePath, dataType, options = {}) {
    try {
      this.log(`开始从JSON文件迁移数据: ${filePath}`);
      this.resetProgress();
      
      // 检查文件是否存在
      const fileExists = await this.checkFileExists(filePath);
      if (!fileExists) {
        throw ErrorHandler.createError(MIGRATION_ERROR_CODES.FILE_NOT_FOUND, {
          filePath
        });
      }
      
      // 读取JSON数据
      const jsonData = await this.readJSONFile(filePath);
      
      // 验证数据格式
      if (this.options.enableValidation) {
        await this.validateData(jsonData, dataType);
      }
      
      // 执行迁移
      const result = await this.executeMigration(jsonData, dataType, options);
      
      this.log(`JSON迁移完成: 处理 ${result.processed} 条记录，错误 ${result.errors} 条`);
      return result;
      
    } catch (error) {
      this.log(`JSON迁移失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, MIGRATION_ERROR_CODES.OPERATION_FAILED, {
        operation: 'migrateFromJSON',
        filePath,
        dataType
      });
    }
  }

  /**
   * 从MongoDB迁移数据
   * @param {string} connectionString - MongoDB连接字符串
   * @param {string} database - 数据库名称
   * @param {string} collection - 集合名称
   * @param {string} dataType - 数据类型
   * @param {Object} options - 迁移选项
   */
  async migrateFromMongoDB(connectionString, database, collection, dataType, options = {}) {
    let mongoClient = null;
    
    try {
      this.log(`开始从MongoDB迁移数据: ${database}.${collection}`);
      this.resetProgress();
      
      // 连接MongoDB
      mongoClient = new MongoClient(connectionString);
      await mongoClient.connect();
      
      const db = mongoClient.db(database);
      const coll = db.collection(collection);
      
      // 获取总记录数
      const totalCount = await coll.countDocuments();
      this.progress.total = totalCount;
      
      this.log(`MongoDB集合 ${collection} 包含 ${totalCount} 条记录`);
      
      // 分批处理数据
      const result = await this.processMongoBatch(coll, dataType, options);
      
      this.log(`MongoDB迁移完成: 处理 ${result.processed} 条记录，错误 ${result.errors} 条`);
      return result;
      
    } catch (error) {
      this.log(`MongoDB迁移失败: ${error.message}`, 'error');
      throw ErrorHandler.wrapError(error, MIGRATION_ERROR_CODES.OPERATION_FAILED, {
        operation: 'migrateFromMongoDB',
        connectionString: connectionString.replace(/\/\/.*@/, '//***@'), // 隐藏密码
        database,
        collection,
        dataType
      });
    } finally {
      if (mongoClient) {
        await mongoClient.close();
      }
    }
  }

  /**
   * 处理MongoDB批量数据
   */
  async processMongoBatch(collection, dataType, options) {
    const batchSize = this.options.batchSize;
    let skip = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    
    while (skip < this.progress.total) {
      try {
        // 获取批量数据
        const batch = await collection.find({})
          .skip(skip)
          .limit(batchSize)
          .toArray();
        
        if (batch.length === 0) break;
        
        // 转换数据格式
        const convertedData = this.convertMongoData(batch, dataType);
        
        // 验证数据
        if (this.options.enableValidation) {
          await this.validateData(convertedData, dataType);
        }
        
        // 执行批量插入
        const batchResult = await this.executeMigration(convertedData, dataType, {
          ...options,
          isBatch: true
        });
        
        totalProcessed += batchResult.processed;
        totalErrors += batchResult.errors;
        
        // 更新进度
        this.updateProgress(batch.length);
        
        skip += batchSize;
        
      } catch (error) {
        this.log(`批量处理失败 (skip: ${skip}): ${error.message}`, 'error');
        totalErrors++;
        skip += batchSize; // 跳过当前批次继续处理
      }
    }
    
    return {
      processed: totalProcessed,
      errors: totalErrors,
      total: this.progress.total
    };
  }

  /**
   * 执行数据迁移
   */
  async executeMigration(data, dataType, options = {}) {
    const connection = await this.connectionManager.getConnection();
    let processed = 0;
    let errors = 0;
    
    try {
      // 开始事务
      await this.connectionManager.runQuery(connection, 'BEGIN TRANSACTION');
      
      const mapping = this.dataMappings[dataType];
      if (!mapping) {
        throw ErrorHandler.createError(MIGRATION_ERROR_CODES.INVALID_DATA, {
          dataType,
          message: '不支持的数据类型'
        });
      }
      
      // 处理数据数组
      const dataArray = Array.isArray(data) ? data : [data];
      
      for (const item of dataArray) {
        try {
          // 转换数据格式
          const convertedItem = this.convertDataItem(item, mapping);
          
          // 插入数据
          await this.insertDataItem(connection, convertedItem, dataType);
          processed++;
          
        } catch (error) {
          this.log(`数据项处理失败: ${error.message}`, 'error');
          this.errors.push({
            item,
            error: error.message,
            timestamp: new Date()
          });
          errors++;
          
          if (!this.options.enableErrorRecovery) {
            throw error;
          }
        }
      }
      
      // 提交事务
      await this.connectionManager.runQuery(connection, 'COMMIT');
      
      return { processed, errors, total: dataArray.length };
      
    } catch (error) {
      // 回滚事务
      try {
        await this.connectionManager.runQuery(connection, 'ROLLBACK');
      } catch (rollbackError) {
        this.log(`事务回滚失败: ${rollbackError.message}`, 'error');
      }
      
      throw error;
      
    } finally {
      this.connectionManager.releaseConnection(connection);
    }
  }

  /**
   * 插入数据项
   */
  async insertDataItem(connection, item, dataType) {
    const tableName = this.getTableName(dataType);
    const fields = Object.keys(item);
    const values = Object.values(item);
    const placeholders = fields.map(() => '?').join(', ');
    
    const sql = `INSERT OR REPLACE INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    
    await this.connectionManager.runQuery(connection, sql, values);
  }

  /**
   * 获取表名
   */
  getTableName(dataType) {
    const tableMap = {
      customers: 'customers',
      sessions: 'sessions',
      messages: 'messages',
      intent_templates: 'intent_templates'
    };
    
    return tableMap[dataType] || dataType;
  }

  /**
   * 转换数据项格式
   */
  convertDataItem(item, mapping) {
    const converted = {};
    
    for (const [sqlField, mongoField] of Object.entries(mapping)) {
      if (typeof mongoField === 'function') {
        converted[sqlField] = mongoField(item);
      } else if (typeof mongoField === 'string') {
        converted[sqlField] = this.getNestedValue(item, mongoField);
      } else {
        converted[sqlField] = mongoField;
      }
    }
    
    return converted;
  }

  /**
   * 获取嵌套属性值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * 转换MongoDB数据格式
   */
  convertMongoData(mongoData, dataType) {
    return mongoData.map(item => {
      // 移除MongoDB的_id字段，转换ObjectId等
      const converted = { ...item };
      delete converted._id;
      
      // 转换日期字段
      this.convertDateFields(converted);
      
      return converted;
    });
  }

  /**
   * 转换日期字段
   */
  convertDateFields(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        obj[key] = value.getTime();
      } else if (value && typeof value === 'object' && value.$date) {
        obj[key] = new Date(value.$date).getTime();
      }
    }
  }

  /**
   * 数据验证
   */
  async validateData(data, dataType) {
    const dataArray = Array.isArray(data) ? data : [data];
    const validator = this.getValidator(dataType);
    
    for (const item of dataArray) {
      const isValid = validator(item);
      if (!isValid) {
        throw ErrorHandler.createError(MIGRATION_ERROR_CODES.VALIDATION_FAILED, {
          dataType,
          item,
          errors: validator.errors
        });
      }
    }
  }

  /**
   * 获取数据验证器
   */
  getValidator(dataType) {
    // 简单的验证器实现
    const validators = {
      customers: (item) => {
        return item && (item.clientId || item.client_id);
      },
      sessions: (item) => {
        return item && (item.sessionId || item.session_id) && (item.clientId || item.client_id);
      },
      messages: (item) => {
        return item && (item.sessionId || item.session_id) && item.content;
      },
      intent_templates: (item) => {
        return item && item.name;
      }
    };
    
    return validators[dataType] || (() => true);
  }

  /**
   * 读取JSON文件
   */
  async readJSONFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw ErrorHandler.wrapError(error, MIGRATION_ERROR_CODES.INVALID_DATA, {
        filePath,
        message: 'JSON文件读取或解析失败'
      });
    }
  }

  /**
   * 检查文件是否存在
   */
  async checkFileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 重置进度
   */
  resetProgress() {
    this.progress = {
      total: 0,
      processed: 0,
      errors: 0,
      startTime: Date.now(),
      endTime: null
    };
    this.errors = [];
  }

  /**
   * 更新进度
   */
  updateProgress(count) {
    this.progress.processed += count;
    
    if (this.options.enableProgressMonitoring) {
      const percentage = ((this.progress.processed / this.progress.total) * 100).toFixed(2);
      this.log(`迁移进度: ${this.progress.processed}/${this.progress.total} (${percentage}%)`);
    }
  }

  /**
   * 获取迁移进度
   */
  getProgress() {
    const elapsed = this.progress.startTime ? Date.now() - this.progress.startTime : 0;
    const percentage = this.progress.total > 0 ? 
      (this.progress.processed / this.progress.total) * 100 : 0;
    
    return {
      ...this.progress,
      percentage: Math.round(percentage * 100) / 100,
      elapsedTime: elapsed,
      estimatedTimeRemaining: this.calculateETA()
    };
  }

  /**
   * 计算预计剩余时间
   */
  calculateETA() {
    if (this.progress.processed === 0) return null;
    
    const elapsed = Date.now() - this.progress.startTime;
    const rate = this.progress.processed / elapsed;
    const remaining = this.progress.total - this.progress.processed;
    
    return remaining > 0 ? Math.round(remaining / rate) : 0;
  }

  /**
   * 获取错误报告
   */
  getErrorReport() {
    return {
      totalErrors: this.errors.length,
      errors: this.errors,
      summary: this.generateErrorSummary()
    };
  }

  /**
   * 生成错误摘要
   */
  generateErrorSummary() {
    const errorTypes = {};
    
    this.errors.forEach(error => {
      const type = error.error.split(':')[0] || 'Unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    
    return errorTypes;
  }

  /**
   * 客户数据映射
   */
  getCustomerMapping() {
    return {
      client_id: 'clientId',
      nickname: 'nickname',
      avatar: 'avatar',
      contact_phone: 'contact.phone',
      contact_email: 'contact.email',
      contact_wechat: 'contact.wechat',
      contact_address: 'contact.address',
      purchase_intention: 'purchaseIntention',
      stats_message_count: 'stats.messageCount',
      stats_response_time: 'stats.responseTime',
      stats_last_active_time: (item) => {
        const time = item.stats?.lastActiveTime || item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      stats_visit_count: 'stats.visitCount',
      stats_first_visit_time: (item) => {
        const time = item.stats?.firstVisitTime || item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      metadata: (item) => {
        const metadata = {
          tags: item.tags || [],
          intentStats: item.intentStats || []
        };
        return JSON.stringify(metadata);
      },
      is_active: () => 1,
      created_at: (item) => {
        const time = item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      updated_at: (item) => {
        const time = item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      }
    };
  }

  /**
   * 会话数据映射
   */
  getSessionMapping() {
    return {
      session_id: 'sessionId',
      client_id: 'clientId',
      status: 'status',
      stats_message_count: 'stats.messageCount',
      stats_client_message_count: 'stats.clientMessageCount',
      stats_server_message_count: 'stats.serverMessageCount',
      stats_start_time: (item) => {
        const time = item.stats?.startTime || item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      stats_last_activity_time: (item) => {
        const time = item.stats?.lastActivityTime || item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      stats_avg_response_time: 'stats.avgResponseTime',
      context_last_intent: 'context.lastIntent',
      context_last_keywords: (item) => {
        return JSON.stringify(item.context?.lastKeywords || []);
      },
      context_last_message_time: (item) => {
        const time = item.context?.lastMessageTime;
        return time ? (time instanceof Date ? time.getTime() : time) : null;
      },
      context_custom_data: (item) => {
        return JSON.stringify(item.context?.customData || {});
      },
      auto_reply_enabled: (item) => item.autoReply?.enabled ? 1 : 0,
      auto_reply_mode: 'autoReply.mode',
      auto_reply_confidence_threshold: 'autoReply.confidenceThreshold',
      created_at: (item) => {
        const time = item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      updated_at: (item) => {
        const time = item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      }
    };
  }

  /**
   * 消息数据映射
   */
  getMessageMapping() {
    return {
      session_id: 'sessionId',
      content: 'content',
      type: 'type',
      sender: 'sender',
      timestamp: (item) => {
        const time = item.timestamp || item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      processed_is_processed: (item) => item.processed?.isProcessed ? 1 : 0,
      processed_intents: (item) => {
        return JSON.stringify(item.processed?.intents || []);
      },
      processed_keywords: (item) => {
        return JSON.stringify(item.processed?.keywords || []);
      },
      processed_sentiment: 'processed.sentiment',
      metadata: (item) => {
        return JSON.stringify(item.metadata || {});
      },
      created_at: (item) => {
        const time = item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      updated_at: (item) => {
        const time = item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      }
    };
  }

  /**
   * 意图模板数据映射
   */
  getIntentTemplateMapping() {
    return {
      name: 'name',
      type: 'type',
      description: 'description',
      confidence_threshold: 'confidenceThreshold',
      config_use_ml: (item) => item.config?.useML ? 1 : 0,
      config_use_patterns: (item) => item.config?.usePatterns ? 1 : 0,
      config_use_keywords: (item) => item.config?.useKeywords ? 1 : 0,
      config_priority: 'config.priority',
      stats_match_count: 'stats.matchCount',
      stats_usage_count: 'stats.usageCount',
      stats_success_rate: 'stats.successRate',
      stats_last_used: (item) => {
        const time = item.stats?.lastUsed;
        return time ? (time instanceof Date ? time.getTime() : time) : null;
      },
      is_system: (item) => item.isSystem ? 1 : 0,
      is_active: (item) => item.isActive !== false ? 1 : 0,
      created_at: (item) => {
        const time = item.createdAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      },
      updated_at: (item) => {
        const time = item.updatedAt || Date.now();
        return time instanceof Date ? time.getTime() : time;
      }
    };
  }

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    if (this.logger) {
      this.logger[level](message);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }
}

export {
  DataMigrationTool,
  MIGRATION_ERROR_CODES
};

export default DataMigrationTool;