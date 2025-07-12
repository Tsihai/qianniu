/**
 * SQLite数据库表结构定义
 * 基于现有Mongoose Schema设计的SQLite表结构
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { Logger } from '../utils/Logger.js';

const sqlite3Verbose = sqlite3.verbose();

class SQLiteSchemaManager {
  constructor() {
    this.logger = new Logger('SQLiteSchemaManager');
  }

  /**
   * 获取所有表的创建SQL语句
   */
  getCreateTableStatements() {
    return {
      customers: this.getCustomersTableSQL(),
      sessions: this.getSessionsTableSQL(),
      messages: this.getMessagesTableSQL(),
      intent_templates: this.getIntentTemplatesTableSQL(),
      intent_patterns: this.getIntentPatternsTableSQL(),
      intent_keywords: this.getIntentKeywordsTableSQL(),
      intent_template_responses: this.getIntentTemplateResponsesTableSQL(),
      customer_tags: this.getCustomerTagsTableSQL(),
      customer_notes: this.getCustomerNotesTableSQL(),
      customer_preferred_intents: this.getCustomerPreferredIntentsTableSQL(),
      session_tags: this.getSessionTagsTableSQL(),
      statistics: this.getStatisticsTableSQL(),
      auto_replies: this.getAutoRepliesTableSQL(),
      customer_behaviors: this.getCustomerBehaviorsTableSQL()
    };
  }

  /**
   * 客户表结构
   */
  getCustomersTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        nickname TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        contact_phone TEXT,
        contact_email TEXT,
        contact_wechat TEXT,
        contact_address TEXT,
        purchase_intention INTEGER DEFAULT 0 CHECK (purchase_intention >= 0 AND purchase_intention <= 100),
        stats_message_count INTEGER DEFAULT 0,
        stats_response_time INTEGER DEFAULT 0,
        stats_last_active_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        stats_visit_count INTEGER DEFAULT 1,
        stats_first_visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  /**
   * 会话表结构
   */
  getSessionsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'idle', 'closed')),
        stats_message_count INTEGER DEFAULT 0,
        stats_client_message_count INTEGER DEFAULT 0,
        stats_server_message_count INTEGER DEFAULT 0,
        stats_start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        stats_last_activity_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        stats_avg_response_time INTEGER DEFAULT 0,
        context_last_intent TEXT,
        context_last_keywords TEXT DEFAULT '[]',
        context_last_message_time DATETIME,
        context_custom_data TEXT DEFAULT '{}',
        auto_reply_enabled BOOLEAN DEFAULT 0,
        auto_reply_mode TEXT DEFAULT 'suggest' CHECK (auto_reply_mode IN ('auto', 'suggest', 'hybrid')),
        auto_reply_confidence_threshold REAL DEFAULT 0.7 CHECK (auto_reply_confidence_threshold >= 0 AND auto_reply_confidence_threshold <= 1),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES customers(client_id)
      )
    `;
  }

  /**
   * 消息表结构
   */
  getMessagesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'chat' CHECK (type IN ('chat', 'system', 'image', 'file', 'unknown')),
        sender TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_is_processed BOOLEAN DEFAULT 0,
        processed_intents TEXT DEFAULT '[]',
        processed_keywords TEXT DEFAULT '[]',
        processed_sentiment TEXT DEFAULT 'unknown' CHECK (processed_sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `;
  }

  /**
   * 意图模板表结构
   */
  getIntentTemplatesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS intent_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT DEFAULT 'custom' CHECK (type IN ('question', 'request', 'greeting', 'farewell', 'complaint', 'praise', 'custom')),
        description TEXT DEFAULT '',
        confidence_threshold REAL DEFAULT 0.6 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
        config_use_ml BOOLEAN DEFAULT 1,
        config_use_patterns BOOLEAN DEFAULT 1,
        config_use_keywords BOOLEAN DEFAULT 1,
        config_priority INTEGER DEFAULT 0,
        stats_match_count INTEGER DEFAULT 0,
        stats_usage_count INTEGER DEFAULT 0,
        stats_success_rate REAL DEFAULT 0,
        stats_last_used DATETIME,
        is_system BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  /**
   * 意图模式表结构
   */
  getIntentPatternsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS intent_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_template_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (intent_template_id) REFERENCES intent_templates(id) ON DELETE CASCADE
      )
    `;
  }

  /**
   * 意图关键词表结构
   */
  getIntentKeywordsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS intent_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_template_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        weight REAL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (intent_template_id) REFERENCES intent_templates(id) ON DELETE CASCADE
      )
    `;
  }

  /**
   * 意图模板回复表结构
   */
  getIntentTemplateResponsesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS intent_template_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_template_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        variables TEXT DEFAULT '[]',
        conditions TEXT DEFAULT '{}',
        weight REAL DEFAULT 1,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (intent_template_id) REFERENCES intent_templates(id) ON DELETE CASCADE
      )
    `;
  }

  /**
   * 客户标签表结构
   */
  getCustomerTagsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS customer_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        UNIQUE(customer_id, tag)
      )
    `;
  }

  /**
   * 客户备注表结构
   */
  getCustomerNotesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS customer_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `;
  }

  /**
   * 客户首选意图表结构
   */
  getCustomerPreferredIntentsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS customer_preferred_intents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        intent TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        UNIQUE(customer_id, intent)
      )
    `;
  }

  /**
   * 会话标签表结构
   */
  getSessionTagsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS session_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE(session_id, tag)
      )
    `;
  }

  /**
   * 统计数据表结构
   */
  getStatisticsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_type TEXT DEFAULT 'counter' CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
        dimensions TEXT DEFAULT '{}',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  /**
   * 自动回复表结构
   */
  getAutoRepliesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_pattern TEXT NOT NULL,
        response_text TEXT NOT NULL,
        confidence_threshold REAL DEFAULT 0.7,
        is_active BOOLEAN DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  /**
   * 客户行为表结构
   */
  getCustomerBehaviorsTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS customer_behaviors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        behavior_type TEXT NOT NULL,
        behavior_data TEXT DEFAULT '{}',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `;
  }

  /**
   * 获取所有索引创建语句
   */
  getCreateIndexStatements() {
    return [
      // 客户表索引
      'CREATE INDEX IF NOT EXISTS idx_customers_client_id ON customers(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_last_active ON customers(stats_last_active_time)',
      'CREATE INDEX IF NOT EXISTS idx_customers_purchase_intention ON customers(purchase_intention)',
      'CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active)',
      
      // 会话表索引
      'CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(stats_last_activity_time)',
      
      // 消息表索引
      'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender)',
      'CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)',
      
      // 意图模板表索引
      'CREATE INDEX IF NOT EXISTS idx_intent_templates_name ON intent_templates(name)',
      'CREATE INDEX IF NOT EXISTS idx_intent_templates_type ON intent_templates(type)',
      'CREATE INDEX IF NOT EXISTS idx_intent_templates_is_active ON intent_templates(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_intent_templates_priority ON intent_templates(config_priority)',
      
      // 意图模式表索引
      'CREATE INDEX IF NOT EXISTS idx_intent_patterns_template_id ON intent_patterns(intent_template_id)',
      'CREATE INDEX IF NOT EXISTS idx_intent_patterns_enabled ON intent_patterns(enabled)',
      
      // 意图关键词表索引
      'CREATE INDEX IF NOT EXISTS idx_intent_keywords_template_id ON intent_keywords(intent_template_id)',
      'CREATE INDEX IF NOT EXISTS idx_intent_keywords_word ON intent_keywords(word)',
      
      // 意图回复表索引
      'CREATE INDEX IF NOT EXISTS idx_intent_responses_template_id ON intent_template_responses(intent_template_id)',
      'CREATE INDEX IF NOT EXISTS idx_intent_responses_enabled ON intent_template_responses(enabled)',
      
      // 客户标签表索引
      'CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON customer_tags(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON customer_tags(tag)',
      
      // 客户备注表索引
      'CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes(created_at)',
      
      // 客户首选意图表索引
      'CREATE INDEX IF NOT EXISTS idx_customer_preferred_intents_customer_id ON customer_preferred_intents(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_preferred_intents_intent ON customer_preferred_intents(intent)',
      
      // 会话标签表索引
      'CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON session_tags(tag)',
      
      // 统计数据表索引
      'CREATE INDEX IF NOT EXISTS idx_statistics_metric_name ON statistics(metric_name)',
      'CREATE INDEX IF NOT EXISTS idx_statistics_timestamp ON statistics(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_statistics_metric_type ON statistics(metric_type)',
      
      // 自动回复表索引
      'CREATE INDEX IF NOT EXISTS idx_auto_replies_is_active ON auto_replies(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_auto_replies_confidence ON auto_replies(confidence_threshold)',
      
      // 客户行为表索引
      'CREATE INDEX IF NOT EXISTS idx_customer_behaviors_customer_id ON customer_behaviors(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_customer_behaviors_type ON customer_behaviors(behavior_type)',
      'CREATE INDEX IF NOT EXISTS idx_customer_behaviors_timestamp ON customer_behaviors(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_customer_behaviors_session_id ON customer_behaviors(session_id)'
    ];
  }

  /**
   * 初始化数据库表结构
   * @param {sqlite3.Database} db - SQLite数据库连接
   */
  async initializeDatabase(db) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        try {
          // 启用外键约束
          db.run('PRAGMA foreign_keys = ON');
          
          // 创建所有表
          const createStatements = this.getCreateTableStatements();
          for (const [tableName, sql] of Object.entries(createStatements)) {
            this.logger.info(`创建表: ${tableName}`);
            db.run(sql, (err) => {
              if (err) {
                this.logger.error(`创建表 ${tableName} 失败:`, err);
                reject(err);
                return;
              }
            });
          }
          
          // 创建所有索引
          const indexStatements = this.getCreateIndexStatements();
          indexStatements.forEach((sql, index) => {
            this.logger.info(`创建索引 ${index + 1}/${indexStatements.length}`);
            db.run(sql, (err) => {
              if (err) {
                this.logger.error(`创建索引失败:`, err);
                reject(err);
                return;
              }
            });
          });
          
          this.logger.info('数据库表结构初始化完成');
          resolve();
        } catch (error) {
          this.logger.error('数据库初始化失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 验证表结构
   * @param {sqlite3.Database} db - SQLite数据库连接
   */
  async validateSchema(db) {
    return new Promise((resolve, reject) => {
      const expectedTables = Object.keys(this.getCreateTableStatements());
      let validatedTables = 0;
      
      expectedTables.forEach(tableName => {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [tableName],
          (err, row) => {
            if (err) {
              this.logger.error(`验证表 ${tableName} 失败:`, err);
              reject(err);
              return;
            }
            
            if (!row) {
              this.logger.error(`表 ${tableName} 不存在`);
              reject(new Error(`表 ${tableName} 不存在`));
              return;
            }
            
            validatedTables++;
            if (validatedTables === expectedTables.length) {
              this.logger.info('所有表结构验证通过');
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * 获取数据库统计信息
   * @param {sqlite3.Database} db - SQLite数据库连接
   */
  async getDatabaseStats(db) {
    return new Promise((resolve, reject) => {
      const stats = {};
      const tables = Object.keys(this.getCreateTableStatements());
      let processedTables = 0;
      
      tables.forEach(tableName => {
        db.get(
          `SELECT COUNT(*) as count FROM ${tableName}`,
          (err, row) => {
            if (err) {
              this.logger.error(`获取表 ${tableName} 统计信息失败:`, err);
              stats[tableName] = { count: 0, error: err.message };
            } else {
              stats[tableName] = { count: row.count };
            }
            
            processedTables++;
            if (processedTables === tables.length) {
              resolve(stats);
            }
          }
        );
      });
    });
  }
}

export default SQLiteSchemaManager;