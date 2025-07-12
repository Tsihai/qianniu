const path = require('path');
const fs = require('fs').promises;
const DataMigrationTool = require('../scripts/migrate');
const SQLiteDataService = require('../services/sqliteDataService');
const { ConfigManager } = require('../config/ConfigManager');

// user context7

describe('DataMigrationTool', () => {
  let migrationTool;
  let testDbPath;
  let testJsonPath;
  let testDataDir;
  
  beforeAll(async () => {
    // 设置测试路径
    testDataDir = path.join(__dirname, '../../data/test_migration');
    testDbPath = path.join(testDataDir, 'migration_test.db');
    testJsonPath = path.join(testDataDir, 'test_data.json');
    
    // 确保测试目录存在
    try {
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
    }
    
    // 创建迁移工具实例
    migrationTool = new DataMigrationTool({
      sourceType: 'json',
      sourcePath: testJsonPath,
      targetType: 'sqlite',
      targetPath: testDbPath,
      batchSize: 10,
      validateData: true
    });
  });
  
  afterAll(async () => {
    // 清理测试文件
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });
  
  beforeEach(async () => {
    // 每个测试前清理测试文件
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // 文件不存在，忽略错误
    }
    
    try {
      await fs.unlink(testJsonPath);
    } catch (error) {
      // 文件不存在，忽略错误
    }
  });
  
  describe('JSON到SQLite迁移', () => {
    test('应该成功迁移客户数据', async () => {
      // 准备测试JSON数据
      const testData = {
        customers: [
          {
            customerId: 'json_customer_001',
            name: 'JSON测试客户1',
            email: 'json1@example.com',
            phone: '13800138001',
            tags: ['JSON', '测试'],
            metadata: { source: 'json_migration' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            customerId: 'json_customer_002',
            name: 'JSON测试客户2',
            email: 'json2@example.com',
            phone: '13800138002',
            tags: ['JSON', '测试', 'VIP'],
            metadata: { source: 'json_migration', level: 'gold' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        sessions: [
          {
            sessionId: 'json_session_001',
            customerId: 'json_customer_001',
            status: 'active',
            startTime: new Date().toISOString(),
            metadata: { channel: 'json_test' }
          }
        ],
        intentTemplates: [
          {
            intent: 'json_greeting',
            keywords: ['你好JSON', 'hello JSON'],
            responses: ['JSON迁移测试回复'],
            confidence: 0.95,
            category: 'test',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
      
      // 写入测试JSON文件
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      // 执行迁移
      const result = await migrationTool.migrate();
      
      // 验证迁移结果
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(4); // 2个客户 + 1个会话 + 1个意图模板
      expect(result.migratedRecords).toBe(4);
      expect(result.errors).toHaveLength(0);
      
      // 验证数据已正确迁移到SQLite
      const sqliteService = new SQLiteDataService({
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      });
      
      await sqliteService.initialize();
      
      // 验证客户数据
      const customers = await sqliteService.Customer.find({});
      expect(customers).toHaveLength(2);
      expect(customers.find(c => c.customerId === 'json_customer_001')).toBeDefined();
      expect(customers.find(c => c.customerId === 'json_customer_002')).toBeDefined();
      
      // 验证会话数据
      const sessions = await sqliteService.Session.find({});
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('json_session_001');
      
      // 验证意图模板数据
      const templates = await sqliteService.IntentTemplate.find({});
      expect(templates).toHaveLength(1);
      expect(templates[0].intent).toBe('json_greeting');
      
      await sqliteService.disconnect();
    });
    
    test('应该处理无效的JSON数据', async () => {
      // 创建包含无效数据的JSON文件
      const invalidData = {
        customers: [
          {
            // 缺少必需的customerId字段
            name: '无效客户',
            email: 'invalid@example.com'
          },
          {
            customerId: 'valid_customer',
            name: '有效客户',
            email: 'valid@example.com'
          }
        ]
      };
      
      await fs.writeFile(testJsonPath, JSON.stringify(invalidData, null, 2), 'utf8');
      
      const result = await migrationTool.migrate();
      
      // 应该部分成功，有错误记录
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.migratedRecords).toBeLessThan(result.totalRecords);
    });
    
    test('应该支持批量迁移', async () => {
      // 创建大量测试数据
      const customers = [];
      for (let i = 0; i < 25; i++) {
        customers.push({
          customerId: `batch_customer_${i.toString().padStart(3, '0')}`,
          name: `批量客户${i}`,
          email: `batch${i}@example.com`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      const testData = { customers };
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      // 设置小的批量大小来测试批量处理
      const batchMigrationTool = new DataMigrationTool({
        sourceType: 'json',
        sourcePath: testJsonPath,
        targetType: 'sqlite',
        targetPath: testDbPath,
        batchSize: 5, // 小批量大小
        validateData: true
      });
      
      const result = await batchMigrationTool.migrate();
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(25);
      expect(result.migratedRecords).toBe(25);
      
      // 验证所有数据都已迁移
      const sqliteService = new SQLiteDataService({
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      });
      
      await sqliteService.initialize();
      const customers_migrated = await sqliteService.Customer.find({});
      expect(customers_migrated).toHaveLength(25);
      await sqliteService.disconnect();
    });
  });
  
  describe('数据验证', () => {
    test('应该验证数据完整性', async () => {
      const testData = {
        customers: [
          {
            customerId: 'validation_customer',
            name: '验证客户',
            email: 'validation@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
      
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      const validationTool = new DataMigrationTool({
        sourceType: 'json',
        sourcePath: testJsonPath,
        targetType: 'sqlite',
        targetPath: testDbPath,
        validateData: true
      });
      
      const result = await validationTool.migrate();
      
      expect(result.success).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });
    
    test('应该检测数据验证错误', async () => {
      const testData = {
        customers: [
          {
            customerId: '', // 空的customerId
            name: '无效客户',
            email: 'invalid-email' // 无效的邮箱格式
          }
        ]
      };
      
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      const validationTool = new DataMigrationTool({
        sourceType: 'json',
        sourcePath: testJsonPath,
        targetType: 'sqlite',
        targetPath: testDbPath,
        validateData: true
      });
      
      const result = await validationTool.migrate();
      
      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });
  });
  
  describe('进度监控', () => {
    test('应该报告迁移进度', async () => {
      const customers = [];
      for (let i = 0; i < 20; i++) {
        customers.push({
          customerId: `progress_customer_${i}`,
          name: `进度客户${i}`,
          email: `progress${i}@example.com`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      const testData = { customers };
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      const progressUpdates = [];
      const progressTool = new DataMigrationTool({
        sourceType: 'json',
        sourcePath: testJsonPath,
        targetType: 'sqlite',
        targetPath: testDbPath,
        batchSize: 5,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });
      
      const result = await progressTool.migrate();
      
      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // 验证进度更新包含必要信息
      progressUpdates.forEach(progress => {
        expect(progress).toHaveProperty('processed');
        expect(progress).toHaveProperty('total');
        expect(progress).toHaveProperty('percentage');
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });
      
      // 最后一个进度更新应该是100%
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.percentage).toBe(100);
    });
  });
  
  describe('错误恢复', () => {
    test('应该在遇到错误时继续处理其他记录', async () => {
      const testData = {
        customers: [
          {
            customerId: 'good_customer_1',
            name: '正常客户1',
            email: 'good1@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            // 缺少customerId - 会导致错误
            name: '错误客户',
            email: 'error@example.com'
          },
          {
            customerId: 'good_customer_2',
            name: '正常客户2',
            email: 'good2@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };
      
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      const result = await migrationTool.migrate();
      
      // 应该处理了3条记录，成功迁移2条，1条失败
      expect(result.totalRecords).toBe(3);
      expect(result.migratedRecords).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.success).toBe(false); // 因为有错误
      
      // 验证成功的记录已迁移
      const sqliteService = new SQLiteDataService({
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      });
      
      await sqliteService.initialize();
      const customers = await sqliteService.Customer.find({});
      expect(customers).toHaveLength(2);
      expect(customers.find(c => c.customerId === 'good_customer_1')).toBeDefined();
      expect(customers.find(c => c.customerId === 'good_customer_2')).toBeDefined();
      await sqliteService.disconnect();
    });
  });
  
  describe('性能测试', () => {
    test('大量数据迁移应该在合理时间内完成', async () => {
      // 创建1000条客户记录
      const customers = [];
      for (let i = 0; i < 1000; i++) {
        customers.push({
          customerId: `perf_customer_${i.toString().padStart(4, '0')}`,
          name: `性能测试客户${i}`,
          email: `perf${i}@example.com`,
          phone: `1380013${i.toString().padStart(4, '0')}`,
          tags: ['性能测试', 'bulk'],
          metadata: { batch: Math.floor(i / 100) },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      const testData = { customers };
      await fs.writeFile(testJsonPath, JSON.stringify(testData, null, 2), 'utf8');
      
      const perfTool = new DataMigrationTool({
        sourceType: 'json',
        sourcePath: testJsonPath,
        targetType: 'sqlite',
        targetPath: testDbPath,
        batchSize: 50, // 较大的批量大小以提高性能
        validateData: false // 跳过验证以提高性能
      });
      
      const startTime = Date.now();
      const result = await perfTool.migrate();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1000);
      expect(result.migratedRecords).toBe(1000);
      
      // 1000条记录的迁移应该在30秒内完成
      expect(duration).toBeLessThan(30000);
      
      console.log(`迁移1000条记录耗时: ${duration}ms`);
    }, 60000); // 设置较长的超时时间
  });
});