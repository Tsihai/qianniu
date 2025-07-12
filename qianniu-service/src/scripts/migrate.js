#!/usr/bin/env node

/**
 * 数据迁移命令行工具
 * 支持从JSON文件和MongoDB迁移数据到SQLite
 */

import { program } from 'commander';
import path from 'path';
import { promises as fs } from 'fs';
import { DataMigrationTool, MIGRATION_ERROR_CODES } from '../utils/dataMigration.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { getLogger } from '../utils/Logger.js';

// 配置命令行参数
program
  .name('migrate')
  .description('数据迁移工具 - 支持JSON和MongoDB到SQLite的数据迁移')
  .version('1.0.0');

// JSON迁移命令
program
  .command('json')
  .description('从JSON文件迁移数据到SQLite')
  .requiredOption('-f, --file <path>', 'JSON文件路径')
  .requiredOption('-t, --type <type>', '数据类型 (customers, sessions, messages, intent_templates)')
  .option('-b, --batch-size <size>', '批处理大小', '100')
  .option('--no-validation', '禁用数据验证')
  .option('--no-progress', '禁用进度监控')
  .option('--no-error-recovery', '禁用错误恢复')
  .option('--backup', '迁移前备份数据库')
  .option('-c, --config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      await executeJSONMigration(options);
    } catch (error) {
      console.error('JSON迁移失败:', error.message);
      process.exit(1);
    }
  });

// MongoDB迁移命令
program
  .command('mongodb')
  .description('从MongoDB迁移数据到SQLite')
  .requiredOption('-u, --uri <uri>', 'MongoDB连接字符串')
  .requiredOption('-d, --database <name>', '数据库名称')
  .requiredOption('-c, --collection <name>', '集合名称')
  .requiredOption('-t, --type <type>', '数据类型 (customers, sessions, messages, intent_templates)')
  .option('-b, --batch-size <size>', '批处理大小', '100')
  .option('--no-validation', '禁用数据验证')
  .option('--no-progress', '禁用进度监控')
  .option('--no-error-recovery', '禁用错误恢复')
  .option('--backup', '迁移前备份数据库')
  .option('--config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      await executeMongoDBMigration(options);
    } catch (error) {
      console.error('MongoDB迁移失败:', error.message);
      process.exit(1);
    }
  });

// 状态检查命令
program
  .command('status')
  .description('检查数据库状态和表结构')
  .option('-c, --config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      await checkDatabaseStatus(options);
    } catch (error) {
      console.error('状态检查失败:', error.message);
      process.exit(1);
    }
  });

// 备份命令
program
  .command('backup')
  .description('备份SQLite数据库')
  .option('-o, --output <path>', '备份文件路径')
  .option('-c, --config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      await backupDatabase(options);
    } catch (error) {
      console.error('备份失败:', error.message);
      process.exit(1);
    }
  });

// 恢复命令
program
  .command('restore')
  .description('从备份恢复SQLite数据库')
  .requiredOption('-i, --input <path>', '备份文件路径')
  .option('-c, --config <path>', '配置文件路径')
  .action(async (options) => {
    try {
      await restoreDatabase(options);
    } catch (error) {
      console.error('恢复失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 执行JSON迁移
 */
async function executeJSONMigration(options) {
  console.log('\n=== JSON数据迁移 ===');
  console.log(`文件: ${options.file}`);
  console.log(`数据类型: ${options.type}`);
  console.log(`批处理大小: ${options.batchSize}`);
  
  // 验证文件路径
  const filePath = path.resolve(options.file);
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  // 验证数据类型
  const validTypes = ['customers', 'sessions', 'messages', 'intent_templates'];
  if (!validTypes.includes(options.type)) {
    throw new Error(`无效的数据类型: ${options.type}. 支持的类型: ${validTypes.join(', ')}`);
  }
  
  // 初始化配置和迁移工具
  const configManager = await initializeConfig(options.config);
  const migrationTool = new DataMigrationTool({
    configManager,
    batchSize: parseInt(options.batchSize),
    enableValidation: options.validation,
    enableProgressMonitoring: options.progress,
    enableErrorRecovery: options.errorRecovery,
    backupBeforeMigration: options.backup
  });
  
  await migrationTool.initialize();
  
  // 执行备份
  if (options.backup) {
    console.log('\n正在备份数据库...');
    await backupDatabase({ config: options.config });
  }
  
  // 执行迁移
  console.log('\n开始迁移...');
  const startTime = Date.now();
  
  const result = await migrationTool.migrateFromJSON(filePath, options.type);
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // 显示结果
  console.log('\n=== 迁移完成 ===');
  console.log(`处理记录: ${result.processed}`);
  console.log(`错误记录: ${result.errors}`);
  console.log(`总记录数: ${result.total}`);
  console.log(`耗时: ${duration.toFixed(2)}秒`);
  
  if (result.errors > 0) {
    console.log('\n=== 错误报告 ===');
    const errorReport = migrationTool.getErrorReport();
    console.log(JSON.stringify(errorReport.summary, null, 2));
  }
}

/**
 * 执行MongoDB迁移
 */
async function executeMongoDBMigration(options) {
  console.log('\n=== MongoDB数据迁移 ===');
  console.log(`连接字符串: ${options.uri.replace(/\/\/.*@/, '//***@')}`);
  console.log(`数据库: ${options.database}`);
  console.log(`集合: ${options.collection}`);
  console.log(`数据类型: ${options.type}`);
  console.log(`批处理大小: ${options.batchSize}`);
  
  // 验证数据类型
  const validTypes = ['customers', 'sessions', 'messages', 'intent_templates'];
  if (!validTypes.includes(options.type)) {
    throw new Error(`无效的数据类型: ${options.type}. 支持的类型: ${validTypes.join(', ')}`);
  }
  
  // 初始化配置和迁移工具
  const configManager = await initializeConfig(options.config);
  const migrationTool = new DataMigrationTool({
    configManager,
    batchSize: parseInt(options.batchSize),
    enableValidation: options.validation,
    enableProgressMonitoring: options.progress,
    enableErrorRecovery: options.errorRecovery,
    backupBeforeMigration: options.backup
  });
  
  await migrationTool.initialize();
  
  // 执行备份
  if (options.backup) {
    console.log('\n正在备份数据库...');
    await backupDatabase({ config: options.config });
  }
  
  // 执行迁移
  console.log('\n开始迁移...');
  const startTime = Date.now();
  
  const result = await migrationTool.migrateFromMongoDB(
    options.uri,
    options.database,
    options.collection,
    options.type
  );
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // 显示结果
  console.log('\n=== 迁移完成 ===');
  console.log(`处理记录: ${result.processed}`);
  console.log(`错误记录: ${result.errors}`);
  console.log(`总记录数: ${result.total}`);
  console.log(`耗时: ${duration.toFixed(2)}秒`);
  
  if (result.errors > 0) {
    console.log('\n=== 错误报告 ===');
    const errorReport = migrationTool.getErrorReport();
    console.log(JSON.stringify(errorReport.summary, null, 2));
  }
}

/**
 * 检查数据库状态
 */
async function checkDatabaseStatus(options) {
  console.log('\n=== 数据库状态检查 ===');
  
  const configManager = await initializeConfig(options.config);
  const migrationTool = new DataMigrationTool({ configManager });
  
  await migrationTool.initialize();
  
  const connection = await migrationTool.connectionManager.getConnection();
  
  try {
    // 检查表是否存在
    const tables = ['customers', 'sessions', 'messages', 'intent_templates'];
    
    for (const table of tables) {
      try {
        const result = await migrationTool.connectionManager.runQuery(
          connection,
          `SELECT COUNT(*) as count FROM ${table}`
        );
        console.log(`表 ${table}: ${result[0].count} 条记录`);
      } catch (error) {
        console.log(`表 ${table}: 不存在或无法访问`);
      }
    }
    
    // 检查数据库文件大小
    const dbPath = configManager.get('database.sqlite.path');
    if (dbPath) {
      try {
        const stats = await fs.stat(dbPath);
        const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`数据库文件大小: ${sizeInMB} MB`);
      } catch {
        console.log('数据库文件: 无法获取大小信息');
      }
    }
    
  } finally {
    migrationTool.connectionManager.releaseConnection(connection);
  }
}

/**
 * 备份数据库
 */
async function backupDatabase(options) {
  const configManager = await initializeConfig(options.config);
  const dbPath = configManager.get('database.sqlite.path');
  
  if (!dbPath) {
    throw new Error('未配置SQLite数据库路径');
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = options.output || `${dbPath}.backup.${timestamp}`;
  
  console.log(`备份数据库: ${dbPath} -> ${backupPath}`);
  
  try {
    await fs.copyFile(dbPath, backupPath);
    console.log('备份完成');
    return backupPath;
  } catch (error) {
    throw new Error(`备份失败: ${error.message}`);
  }
}

/**
 * 恢复数据库
 */
async function restoreDatabase(options) {
  const configManager = await initializeConfig(options.config);
  const dbPath = configManager.get('database.sqlite.path');
  
  if (!dbPath) {
    throw new Error('未配置SQLite数据库路径');
  }
  
  const backupPath = path.resolve(options.input);
  
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`备份文件不存在: ${backupPath}`);
  }
  
  console.log(`恢复数据库: ${backupPath} -> ${dbPath}`);
  
  try {
    await fs.copyFile(backupPath, dbPath);
    console.log('恢复完成');
  } catch (error) {
    throw new Error(`恢复失败: ${error.message}`);
  }
}

/**
 * 初始化配置
 */
async function initializeConfig(configPath) {
  const configManager = new ConfigManager();
  
  if (configPath) {
    const fullPath = path.resolve(configPath);
    try {
      await fs.access(fullPath);
      await configManager.loadFromFile(fullPath);
    } catch {
      throw new Error(`配置文件不存在: ${fullPath}`);
    }
  } else {
    // 使用默认配置
    await configManager.initialize();
  }
  
  return configManager;
}

/**
 * 显示使用帮助
 */
function showUsageExamples() {
  console.log('\n使用示例:');
  console.log('\n1. 从JSON文件迁移客户数据:');
  console.log('   node migrate.js json -f ./data/customers.json -t customers');
  
  console.log('\n2. 从MongoDB迁移会话数据:');
  console.log('   node migrate.js mongodb -u mongodb://localhost:27017 -d qianniu -c sessions -t sessions');
  
  console.log('\n3. 检查数据库状态:');
  console.log('   node migrate.js status');
  
  console.log('\n4. 备份数据库:');
  console.log('   node migrate.js backup -o ./backup/db.backup');
  
  console.log('\n5. 恢复数据库:');
  console.log('   node migrate.js restore -i ./backup/db.backup');
}

// 添加帮助命令
program
  .command('examples')
  .description('显示使用示例')
  .action(showUsageExamples);

// 解析命令行参数
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);

// 导出模块供测试使用
export {
  executeJSONMigration,
  executeMongoDBMigration,
  checkDatabaseStatus,
  backupDatabase,
  restoreDatabase,
  initializeConfig
};