/**
 * SQLite数据库初始化脚本
 * 用于创建数据库表结构和索引
 */

import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
const sqlite3Verbose = sqlite3.verbose();
import SQLiteSchemaManager from '../config/sqliteSchema.js';
import Logger from '../utils/Logger.js';
import { ConfigManager } from '../config/ConfigManager.js';

class DatabaseInitializer {
  constructor() {
    this.logger = new Logger('DatabaseInitializer');
    this.schemaManager = new SQLiteSchemaManager();
  }

  /**
   * 初始化SQLite数据库
   * @param {string} dbPath - 数据库文件路径
   * @param {boolean} force - 是否强制重新创建
   */
  async initializeDatabase(dbPath, force = false) {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.info(`创建数据库目录: ${dbDir}`);
      }

      // 如果强制重新创建，删除现有数据库文件
      if (force && fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        this.logger.info(`删除现有数据库文件: ${dbPath}`);
      }

      // 创建数据库连接
      const db = new sqlite3Verbose.Database(dbPath, (err) => {
        if (err) {
          this.logger.error('数据库连接失败:', err);
          throw err;
        }
        this.logger.info(`数据库连接成功: ${dbPath}`);
      });

      // 初始化表结构
      await this.schemaManager.initializeDatabase(db);

      // 验证表结构
      await this.schemaManager.validateSchema(db);

      // 获取数据库统计信息
      const stats = await this.schemaManager.getDatabaseStats(db);
      this.logger.info('数据库统计信息:', stats);

      // 关闭数据库连接
      db.close((err) => {
        if (err) {
          this.logger.error('关闭数据库连接失败:', err);
        } else {
          this.logger.info('数据库连接已关闭');
        }
      });

      return {
        success: true,
        message: '数据库初始化完成',
        stats
      };

    } catch (error) {
      this.logger.error('数据库初始化失败:', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }

  /**
   * 检查数据库是否已初始化
   * @param {string} dbPath - 数据库文件路径
   */
  async checkDatabaseExists(dbPath) {
    try {
      if (!fs.existsSync(dbPath)) {
        return {
          exists: false,
          message: '数据库文件不存在'
        };
      }

      const db = new sqlite3Verbose.Database(dbPath, sqlite3.OPEN_READONLY);
      
      return new Promise((resolve) => {
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='customers'",
          (err, row) => {
            db.close();
            
            if (err || !row) {
              resolve({
                exists: false,
                message: '数据库表结构不完整'
              });
            } else {
              resolve({
                exists: true,
                message: '数据库已初始化'
              });
            }
          }
        );
      });

    } catch (error) {
      return {
        exists: false,
        message: error.message,
        error
      };
    }
  }

  /**
   * 备份数据库
   * @param {string} dbPath - 源数据库路径
   * @param {string} backupPath - 备份路径
   */
  async backupDatabase(dbPath, backupPath) {
    try {
      if (!fs.existsSync(dbPath)) {
        throw new Error('源数据库文件不存在');
      }

      // 确保备份目录存在
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // 复制数据库文件
      fs.copyFileSync(dbPath, backupPath);
      
      this.logger.info(`数据库备份完成: ${dbPath} -> ${backupPath}`);
      
      return {
        success: true,
        message: '数据库备份完成',
        backupPath
      };

    } catch (error) {
      this.logger.error('数据库备份失败:', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }

  /**
   * 恢复数据库
   * @param {string} backupPath - 备份文件路径
   * @param {string} dbPath - 目标数据库路径
   */
  async restoreDatabase(backupPath, dbPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error('备份文件不存在');
      }

      // 确保目标目录存在
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 复制备份文件
      fs.copyFileSync(backupPath, dbPath);
      
      this.logger.info(`数据库恢复完成: ${backupPath} -> ${dbPath}`);
      
      return {
        success: true,
        message: '数据库恢复完成',
        dbPath
      };

    } catch (error) {
      this.logger.error('数据库恢复失败:', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }
}

// 命令行执行
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const initializer = new DatabaseInitializer();
  const logger = new Logger('DatabaseInitScript');
  
  async function main() {
    try {
      // 加载配置
      const configManager = ConfigManager.getInstance();
      await configManager.initialize();
      
      const dbConfig = configManager.getDatabaseConfig('sqlite');
      const dbPath = path.resolve(dbConfig.dbPath);
      
      switch (command) {
        case 'init':
          const force = args.includes('--force');
          logger.info(`初始化数据库: ${dbPath} (force: ${force})`);
          const initResult = await initializer.initializeDatabase(dbPath, force);
          console.log(JSON.stringify(initResult, null, 2));
          break;
          
        case 'check':
          logger.info(`检查数据库: ${dbPath}`);
          const checkResult = await initializer.checkDatabaseExists(dbPath);
          console.log(JSON.stringify(checkResult, null, 2));
          break;
          
        case 'backup':
          const backupPath = args[1] || `${dbPath}.backup.${Date.now()}`;
          logger.info(`备份数据库: ${dbPath} -> ${backupPath}`);
          const backupResult = await initializer.backupDatabase(dbPath, backupPath);
          console.log(JSON.stringify(backupResult, null, 2));
          break;
          
        case 'restore':
          const restoreFrom = args[1];
          if (!restoreFrom) {
            throw new Error('请指定备份文件路径');
          }
          logger.info(`恢复数据库: ${restoreFrom} -> ${dbPath}`);
          const restoreResult = await initializer.restoreDatabase(restoreFrom, dbPath);
          console.log(JSON.stringify(restoreResult, null, 2));
          break;
          
        default:
          console.log(`
使用方法:
  node initSQLiteDatabase.js <command> [options]

命令:
  init [--force]    初始化数据库表结构
  check            检查数据库是否存在
  backup [path]    备份数据库
  restore <path>   从备份恢复数据库

示例:
  node initSQLiteDatabase.js init
  node initSQLiteDatabase.js init --force
  node initSQLiteDatabase.js check
  node initSQLiteDatabase.js backup ./backup/db.backup
  node initSQLiteDatabase.js restore ./backup/db.backup
`);
          process.exit(1);
      }
      
    } catch (error) {
      logger.error('脚本执行失败:', error);
      console.error(JSON.stringify({
        success: false,
        message: error.message,
        error: error.stack
      }, null, 2));
      process.exit(1);
    }
  }
  
  main();
}

export default DatabaseInitializer;