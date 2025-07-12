const DataServiceFactory = require('../services/dataServiceFactory');
const { ConfigManager } = require('../config/ConfigManager');
const path = require('path');
const fs = require('fs').promises;

describe('数据服务集成测试', () => {
  let configManager;
  let testDataDir;
  let testDbPath;
  let testJsonPath;
  
  beforeAll(async () => {
    // 设置测试路径
    testDataDir = path.join(__dirname, '../../data/test_integration');
    testDbPath = path.join(testDataDir, 'integration_test.db');
    testJsonPath = path.join(testDataDir, 'integration_test.json');
    
    // 确保测试目录存在
    try {
      await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
    }
    
    // 初始化配置管理器
    configManager = new ConfigManager();
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
  
  describe('数据服务工厂', () => {
    test('应该根据配置创建正确的数据服务', async () => {
      // 测试SQLite服务创建
      configManager.setDatabaseType('sqlite');
      const sqliteConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      };
      
      const sqliteService = DataServiceFactory.createDataService(sqliteConfig);
      expect(sqliteService.constructor.name).toBe('SQLiteDataService');
      
      // 测试JSON服务创建
      configManager.setDatabaseType('json');
      const jsonConfig = {
        mockMode: false,
        database: {
          json: {
            path: testJsonPath
          }
        }
      };
      
      const jsonService = DataServiceFactory.createDataService(jsonConfig);
      expect(jsonService.constructor.name).toBe('JSONDataService');
      
      // 测试Mock服务创建
      const mockConfig = { mockMode: true };
      const mockService = DataServiceFactory.createDataService(mockConfig);
      expect(mockService.constructor.name).toBe('MockDataService');
    });
    
    test('应该抛出未知数据库类型的错误', () => {
      configManager.setDatabaseType('unknown');
      const config = {
        mockMode: false,
        database: {
          unknown: {}
        }
      };
      
      expect(() => {
        DataServiceFactory.createDataService(config);
      }).toThrow('未知的数据库类型');
    });
  });
  
  describe('数据服务切换', () => {
    test('应该能够在不同数据服务之间切换', async () => {
      // 创建测试数据
      const testCustomer = {
        customerId: 'switch_test_customer',
        name: '切换测试客户',
        email: 'switch@example.com',
        phone: '13800138000',
        tags: ['切换测试'],
        metadata: { test: 'switch' }
      };
      
      // 1. 使用SQLite服务
      configManager.setDatabaseType('sqlite');
      const sqliteConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      };
      
      const sqliteService = DataServiceFactory.createDataService(sqliteConfig);
      await sqliteService.initialize();
      
      // 在SQLite中创建客户
      const createdCustomer = await sqliteService.Customer.create(testCustomer);
      expect(createdCustomer.customerId).toBe(testCustomer.customerId);
      
      // 验证客户存在
      const foundCustomer = await sqliteService.Customer.findOne({ customerId: testCustomer.customerId });
      expect(foundCustomer).toBeDefined();
      expect(foundCustomer.name).toBe(testCustomer.name);
      
      await sqliteService.disconnect();
      
      // 2. 切换到JSON服务
      configManager.setDatabaseType('json');
      const jsonConfig = {
        mockMode: false,
        database: {
          json: {
            path: testJsonPath
          }
        }
      };
      
      const jsonService = DataServiceFactory.createDataService(jsonConfig);
      await jsonService.initialize();
      
      // 在JSON服务中创建相同的客户
      const jsonCustomer = await jsonService.Customer.create(testCustomer);
      expect(jsonCustomer.customerId).toBe(testCustomer.customerId);
      
      // 验证客户存在于JSON服务中
      const jsonFoundCustomer = await jsonService.Customer.findOne({ customerId: testCustomer.customerId });
      expect(jsonFoundCustomer).toBeDefined();
      expect(jsonFoundCustomer.name).toBe(testCustomer.name);
      
      await jsonService.disconnect();
      
      // 3. 切换回SQLite服务，验证数据仍然存在
      configManager.setDatabaseType('sqlite');
      const sqliteService2 = DataServiceFactory.createDataService(sqliteConfig);
      await sqliteService2.initialize();
      
      const sqliteFoundCustomer = await sqliteService2.Customer.findOne({ customerId: testCustomer.customerId });
      expect(sqliteFoundCustomer).toBeDefined();
      expect(sqliteFoundCustomer.name).toBe(testCustomer.name);
      
      await sqliteService2.disconnect();
    });
  });
  
  describe('数据一致性测试', () => {
    test('相同操作在不同数据服务中应该产生一致的结果', async () => {
      const testData = {
        customerId: 'consistency_customer',
        name: '一致性测试客户',
        email: 'consistency@example.com',
        phone: '13800138001',
        tags: ['一致性', '测试'],
        metadata: { test: 'consistency' }
      };
      
      const services = [];
      
      // 创建SQLite服务
      const sqliteConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      };
      const sqliteService = DataServiceFactory.createDataService(sqliteConfig);
      await sqliteService.initialize();
      services.push({ name: 'SQLite', service: sqliteService });
      
      // 创建JSON服务
      const jsonConfig = {
        mockMode: false,
        database: {
          json: {
            path: testJsonPath
          }
        }
      };
      const jsonService = DataServiceFactory.createDataService(jsonConfig);
      await jsonService.initialize();
      services.push({ name: 'JSON', service: jsonService });
      
      // 在所有服务中执行相同的操作
      const results = [];
      
      for (const { name, service } of services) {
        // 创建客户
        const created = await service.Customer.create(testData);
        
        // 查找客户
        const found = await service.Customer.findOne({ customerId: testData.customerId });
        
        // 更新客户
        const updated = await service.Customer.update(
          { customerId: testData.customerId },
          { name: `${testData.name} - 已更新` }
        );
        
        // 再次查找验证更新
        const foundAfterUpdate = await service.Customer.findOne({ customerId: testData.customerId });
        
        results.push({
          serviceName: name,
          created: created,
          found: found,
          updated: updated,
          foundAfterUpdate: foundAfterUpdate
        });
      }
      
      // 验证所有服务的结果一致
      const [sqliteResult, jsonResult] = results;
      
      // 验证创建结果一致
      expect(sqliteResult.created.customerId).toBe(jsonResult.created.customerId);
      expect(sqliteResult.created.name).toBe(jsonResult.created.name);
      expect(sqliteResult.created.email).toBe(jsonResult.created.email);
      
      // 验证查找结果一致
      expect(sqliteResult.found.customerId).toBe(jsonResult.found.customerId);
      expect(sqliteResult.found.name).toBe(jsonResult.found.name);
      
      // 验证更新结果一致
      expect(sqliteResult.foundAfterUpdate.name).toBe(jsonResult.foundAfterUpdate.name);
      expect(sqliteResult.foundAfterUpdate.name).toContain('已更新');
      
      // 清理
      for (const { service } of services) {
        await service.disconnect();
      }
    });
  });
  
  describe('健康检查集成', () => {
    test('所有数据服务应该通过健康检查', async () => {
      const configs = [
        {
          name: 'SQLite',
          config: {
            mockMode: false,
            database: {
              sqlite: {
                path: testDbPath
              }
            }
          }
        },
        {
          name: 'JSON',
          config: {
            mockMode: false,
            database: {
              json: {
                path: testJsonPath
              }
            }
          }
        },
        {
          name: 'Mock',
          config: {
            mockMode: true
          }
        }
      ];
      
      for (const { name, config } of configs) {
        const service = DataServiceFactory.createDataService(config);
        await service.initialize();
        
        const healthCheck = await service.healthCheck();
        expect(healthCheck.status).toBe('healthy');
        expect(healthCheck.service).toBe(name.toLowerCase());
        
        await service.disconnect();
      }
    });
    
    test('应该检测到不健康的数据服务', async () => {
      // 创建一个指向不存在目录的SQLite配置
      const invalidConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: '/invalid/path/test.db'
          }
        }
      };
      
      const service = DataServiceFactory.createDataService(invalidConfig);
      
      // 初始化应该失败或健康检查应该失败
      try {
        await service.initialize();
        const healthCheck = await service.healthCheck();
        expect(healthCheck.status).toBe('unhealthy');
      } catch (error) {
        // 初始化失败是预期的
        expect(error).toBeDefined();
      }
    });
  });
  
  describe('并发操作测试', () => {
    test('应该正确处理并发的数据操作', async () => {
      const sqliteConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      };
      
      const service = DataServiceFactory.createDataService(sqliteConfig);
      await service.initialize();
      
      // 创建多个并发的客户创建操作
      const concurrentOperations = [];
      for (let i = 0; i < 10; i++) {
        const customerData = {
          customerId: `concurrent_customer_${i}`,
          name: `并发客户${i}`,
          email: `concurrent${i}@example.com`,
          phone: `1380013800${i}`,
          tags: ['并发测试'],
          metadata: { index: i }
        };
        
        concurrentOperations.push(service.Customer.create(customerData));
      }
      
      // 等待所有操作完成
      const results = await Promise.all(concurrentOperations);
      
      // 验证所有操作都成功
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.customerId).toBe(`concurrent_customer_${index}`);
        expect(result.name).toBe(`并发客户${index}`);
      });
      
      // 验证所有客户都已保存
      const allCustomers = await service.Customer.find({});
      const concurrentCustomers = allCustomers.filter(c => c.customerId.startsWith('concurrent_customer_'));
      expect(concurrentCustomers).toHaveLength(10);
      
      await service.disconnect();
    });
  });
  
  describe('错误处理集成', () => {
    test('应该正确处理数据服务错误', async () => {
      const sqliteConfig = {
        mockMode: false,
        database: {
          sqlite: {
            path: testDbPath
          }
        }
      };
      
      const service = DataServiceFactory.createDataService(sqliteConfig);
      await service.initialize();
      
      // 尝试创建无效的客户数据
      const invalidCustomer = {
        // 缺少必需的customerId
        name: '无效客户',
        email: 'invalid@example.com'
      };
      
      await expect(service.Customer.create(invalidCustomer)).rejects.toThrow();
      
      // 尝试查找不存在的客户
      const notFound = await service.Customer.findOne({ customerId: 'non_existent' });
      expect(notFound).toBeNull();
      
      // 尝试更新不存在的客户
      const updateResult = await service.Customer.update(
        { customerId: 'non_existent' },
        { name: '新名称' }
      );
      expect(updateResult.modifiedCount).toBe(0);
      
      await service.disconnect();
    });
  });
  
  describe('性能对比测试', () => {
    test('应该比较不同数据服务的性能', async () => {
      const testData = [];
      for (let i = 0; i < 100; i++) {
        testData.push({
          customerId: `perf_customer_${i}`,
          name: `性能测试客户${i}`,
          email: `perf${i}@example.com`,
          phone: `1380013${i.toString().padStart(4, '0')}`,
          tags: ['性能测试'],
          metadata: { index: i }
        });
      }
      
      const services = [
        {
          name: 'SQLite',
          config: {
            mockMode: false,
            database: {
              sqlite: {
                path: testDbPath
              }
            }
          }
        },
        {
          name: 'JSON',
          config: {
            mockMode: false,
            database: {
              json: {
                path: testJsonPath
              }
            }
          }
        }
      ];
      
      const performanceResults = [];
      
      for (const { name, config } of services) {
        const service = DataServiceFactory.createDataService(config);
        await service.initialize();
        
        // 测试批量创建性能
        const startTime = Date.now();
        
        for (const customerData of testData) {
          await service.Customer.create(customerData);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 测试查询性能
        const queryStartTime = Date.now();
        const allCustomers = await service.Customer.find({});
        const queryEndTime = Date.now();
        const queryDuration = queryEndTime - queryStartTime;
        
        performanceResults.push({
          service: name,
          createDuration: duration,
          queryDuration: queryDuration,
          recordCount: allCustomers.length
        });
        
        await service.disconnect();
        
        console.log(`${name}服务性能: 创建${testData.length}条记录耗时${duration}ms, 查询耗时${queryDuration}ms`);
      }
      
      // 验证所有服务都成功处理了数据
      performanceResults.forEach(result => {
        expect(result.recordCount).toBe(testData.length);
        expect(result.createDuration).toBeGreaterThan(0);
        expect(result.queryDuration).toBeGreaterThan(0);
      });
    }, 30000); // 设置较长的超时时间
  });
});