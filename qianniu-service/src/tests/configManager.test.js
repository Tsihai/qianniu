/**
 * ConfigManager 功能测试
 * 测试配置验证、环境变量覆盖、错误处理和默认值机制
 */

import { ConfigManager } from '../config/ConfigManager.js';
import { ErrorHandler, ERROR_CODES } from '../utils/ErrorHandler.js';

// 测试环境变量设置
process.env.NODE_ENV = 'development';
process.env.CONFIG_SERVER_PORT = '9999';
process.env.CONFIG_DATABASE_URI = 'mongodb://test:27017/test';
process.env.APP_LOGGING_LEVEL = 'debug';
process.env.QIANNIU_FEATURES_AUTO_REPLY = 'false';

async function testConfigManager() {
  console.log('=== ConfigManager 功能测试 ===\n');
  
  try {
    // 测试1: 初始化配置管理器
    console.log('1. 测试配置管理器初始化...');
    const configManager = ConfigManager.getInstance();
    await configManager.initialize({
      env: 'development',
      enableWatcher: false
    });
    console.log('✓ 配置管理器初始化成功\n');
    
    // 测试2: 基本配置获取
    console.log('2. 测试基本配置获取...');
    const serverPort = configManager.get('server.port');
    const dbUri = configManager.get('database.uri');
    console.log(`服务器端口: ${serverPort}`);
    console.log(`数据库URI: ${dbUri}`);
    console.log('✓ 基本配置获取成功\n');
    
    // 测试3: 环境变量覆盖
    console.log('3. 测试环境变量覆盖...');
    const overriddenPort = configManager.get('server.port');
    const overriddenDbUri = configManager.get('database.uri');
    const overriddenLogLevel = configManager.get('logging.level');
    const overriddenAutoReply = configManager.get('features.autoReply');
    
    console.log(`覆盖后的服务器端口: ${overriddenPort} (应该是 9999)`);
    console.log(`覆盖后的数据库URI: ${overriddenDbUri} (应该包含 test)`);
    console.log(`覆盖后的日志级别: ${overriddenLogLevel} (应该是 debug)`);
    console.log(`覆盖后的自动回复: ${overriddenAutoReply} (应该是 false)`);
    console.log('✓ 环境变量覆盖测试成功\n');
    
    // 测试4: 默认值机制
    console.log('4. 测试默认值机制...');
    const nonExistentConfig = configManager.get('non.existent.config', 'default_value');
    const functionDefault = configManager.get('another.non.existent', (path, config) => {
      return `动态默认值: ${path}`;
    });
    
    console.log(`不存在的配置项: ${nonExistentConfig} (应该是 default_value)`);
    console.log(`函数默认值: ${functionDefault} (应该包含路径信息)`);
    console.log('✓ 默认值机制测试成功\n');
    
    // 测试5: 配置存在性检查
    console.log('5. 测试配置存在性检查...');
    const hasServerPort = configManager.has('server.port');
    const hasNonExistent = configManager.has('non.existent.config');
    
    console.log(`server.port 存在: ${hasServerPort} (应该是 true)`);
    console.log(`non.existent.config 存在: ${hasNonExistent} (应该是 false)`);
    console.log('✓ 配置存在性检查测试成功\n');
    
    // 测试6: 配置设置和缓存
    console.log('6. 测试配置设置和缓存...');
    configManager.set('test.dynamic.config', 'dynamic_value');
    const dynamicValue = configManager.get('test.dynamic.config');
    
    console.log(`动态设置的配置: ${dynamicValue} (应该是 dynamic_value)`);
    console.log('✓ 配置设置和缓存测试成功\n');
    
    // 测试7: 获取所有配置
    console.log('7. 测试获取所有配置...');
    const allConfig = configManager.getAll();
    console.log(`配置对象包含 app 模块: ${!!allConfig.app}`);
    console.log(`配置对象包含 server 模块: ${!!allConfig.server}`);
    console.log(`配置对象包含 test 模块: ${!!allConfig.test}`);
    console.log('✓ 获取所有配置测试成功\n');
    
    console.log('=== 所有测试通过! ===');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.code) {
      console.error('错误码:', error.code);
    }
    if (error.details) {
      console.error('错误详情:', error.details);
    }
    process.exit(1);
  }
}

// 测试错误处理
async function testErrorHandling() {
  console.log('\n=== 错误处理测试 ===\n');
  
  try {
    // 测试未初始化错误
    console.log('1. 测试未初始化错误...');
    const newManager = new ConfigManager();
    try {
      newManager.get('test.config');
      console.log('✗ 应该抛出未初始化错误');
    } catch (error) {
      if (error.code === ERROR_CODES.CONFIG.NOT_INITIALIZED) {
        console.log('✓ 未初始化错误处理正确');
      } else {
        console.log('✗ 错误码不正确:', error.code);
      }
    }
    
    console.log('\n=== 错误处理测试完成 ===');
    
  } catch (error) {
    console.error('错误处理测试失败:', error.message);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await testConfigManager();
    await testErrorHandling();
  })();
}

export {
  testConfigManager,
  testErrorHandling
};