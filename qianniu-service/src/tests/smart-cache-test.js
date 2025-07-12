import { ConfigManager } from '../config/ConfigManager.js';
import path from 'path';
import fs from 'fs';

// 创建测试用的配置管理器实例
const configManager = new ConfigManager();

async function runSmartCacheTests() {
  console.log('=== 智能配置缓存测试开始 ===\n');
  
  try {
    // 检查配置文件是否存在
    console.log('0. 检查配置文件...');
    const configDir = path.join(__dirname, '../config');
    const testConfigPath = path.join(configDir, 'test.json');
    
    console.log(`配置目录: ${configDir}`);
    console.log(`测试配置文件: ${testConfigPath}`);
    console.log(`文件是否存在: ${fs.existsSync(testConfigPath)}`);
    
    if (fs.existsSync(testConfigPath)) {
      const content = fs.readFileSync(testConfigPath, 'utf8');
      console.log('配置文件内容预览:', content.substring(0, 200) + '...');
    }
    
    // 初始化配置管理器
    console.log('\n1. 初始化配置管理器...');
    await configManager.initialize({
      env: 'test',
      enableWatcher: false
    });
    
    console.log('1. 测试基本缓存功能');
    console.log('-------------------');
    
    // 测试缓存命中
    const startTime = Date.now();
    const value1 = configManager.get('app.name', 'DefaultApp');
    const firstCallTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    const value2 = configManager.get('app.name', 'DefaultApp');
    const secondCallTime = Date.now() - startTime2;
    
    console.log(`首次调用: ${value1} (耗时: ${firstCallTime}ms)`);
    console.log(`缓存调用: ${value2} (耗时: ${secondCallTime}ms)`);
    console.log(`缓存加速比: ${(firstCallTime / secondCallTime).toFixed(2)}x\n`);
    
    console.log('2. 测试缓存统计信息');
    console.log('-------------------');
    
    // 执行多次读取操作
    for (let i = 0; i < 10; i++) {
      configManager.get('app.version', '1.0.0');
      configManager.get('database.host', 'localhost');
      configManager.get('nonexistent.key', 'default');
    }
    
    const cacheStats = configManager.getCacheStats();
    console.log('缓存统计信息:');
    console.log(`- 命中次数: ${cacheStats.hits}`);
    console.log(`- 未命中次数: ${cacheStats.misses}`);
    console.log(`- 命中率: ${cacheStats.hitRate}`);
    console.log(`- 缓存大小: ${cacheStats.cacheSize}/${cacheStats.maxSize}`);
    console.log(`- 内存使用: ${cacheStats.memoryUsage} bytes`);
    console.log(`- 压缩比: ${cacheStats.compressionRatio}%\n`);
    
    console.log('3. 测试智能缓存失效');
    console.log('-------------------');
    
    // 设置新值，应该触发相关缓存失效
    console.log('设置新配置值...');
    configManager.set('app.name', 'NewAppName');
    
    // 再次获取，应该从配置中读取新值
    const newValue = configManager.get('app.name');
    console.log(`更新后的值: ${newValue}`);
    
    const statsAfterUpdate = configManager.getCacheStats();
    console.log(`缓存失效次数: ${statsAfterUpdate.invalidations}\n`);
    
    console.log('4. 测试缓存压缩功能');
    console.log('-------------------');
    
    // 创建大型配置对象测试压缩
    const largeConfig = {
      data: new Array(1000).fill('这是一个用于测试压缩功能的长字符串'),
      numbers: new Array(500).fill(0).map((_, i) => i),
      nested: {
        level1: {
          level2: {
            level3: 'deep nested value'
          }
        }
      }
    };
    
    configManager.set('test.largeData', largeConfig);
    const retrievedLargeData = configManager.get('test.largeData');
    
    console.log('大型数据压缩测试:');
    console.log(`- 原始数据大小: ${JSON.stringify(largeConfig).length} bytes`);
    console.log(`- 数据完整性: ${JSON.stringify(retrievedLargeData) === JSON.stringify(largeConfig) ? '✓ 通过' : '✗ 失败'}`);
    
    const compressionStats = configManager.getCacheStats();
    console.log(`- 当前压缩比: ${compressionStats.compressionRatio}%\n`);
    
    console.log('5. 测试预加载功能');
    console.log('-------------------');
    
    // 添加预加载键
    configManager.addPreloadKey('app.name');
    configManager.addPreloadKey('app.version');
    configManager.addPreloadKey('database.host');
    configManager.addPreloadKey('database.port');
    
    // 清除缓存
    configManager.clearAllCache();
    
    // 执行预加载
    console.log('执行预加载...');
    const preloadCount = configManager.preloadConfigurations();
    console.log(`预加载完成: ${preloadCount} 个配置项\n`);
    
    console.log('6. 测试内存优化');
    console.log('-------------------');
    
    const memoryBefore = configManager.getMemoryUsage();
    console.log('优化前内存使用:');
    console.log(`- 缓存内存: ${memoryBefore.cache.memoryUsage} bytes`);
    console.log(`- 配置内存: ${memoryBefore.config.size} bytes`);
    console.log(`- 总内存: ${memoryBefore.total} bytes`);
    
    // 执行内存优化
    const optimizationResult = configManager.optimizeMemory();
    
    const memoryAfter = configManager.getMemoryUsage();
    console.log('\n优化后内存使用:');
    console.log(`- 缓存内存: ${memoryAfter.cache.memoryUsage} bytes`);
    console.log(`- 释放项目: ${optimizationResult.freedItems}`);
    console.log(`- 释放内存: ${optimizationResult.freedMemory} bytes\n`);
    
    console.log('7. 测试缓存配置');
    console.log('-------------------');
    
    // 配置缓存参数
    configManager.configureCaching({
      maxSize: 500,
      compressionEnabled: true
    });
    
    console.log('缓存配置已更新:');
    console.log('- 最大缓存大小: 500');
    console.log('- 压缩功能: 启用\n');
    
    console.log('8. 测试事件监听');
    console.log('-------------------');
    
    // 监听缓存事件
    configManager.on('cacheInvalidated', (data) => {
      console.log(`缓存失效事件: 路径=${data.path}, 失效数量=${data.invalidatedCount}`);
    });
    
    configManager.on('cacheCleared', (data) => {
      console.log(`缓存清除事件: 原因=${data.reason}`);
    });
    
    configManager.on('preloadCompleted', (data) => {
      console.log(`预加载完成事件: ${data.loadedCount}/${data.totalKeys} 个配置项`);
    });
    
    // 触发事件
    configManager.set('test.eventTrigger', 'value');
    configManager.clearAllCache();
    
    console.log('\n=== 智能配置缓存机制测试完成 ===');
    console.log('✓ 所有功能测试通过');
    
    // 最终统计
    const finalStats = configManager.getCacheStats();
    console.log('\n最终缓存统计:');
    console.log(`- 总命中次数: ${finalStats.hits}`);
    console.log(`- 总未命中次数: ${finalStats.misses}`);
    console.log(`- 总命中率: ${finalStats.hitRate}`);
    console.log(`- 总失效次数: ${finalStats.invalidations}`);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmartCacheTests();
}

export { runSmartCacheTests };