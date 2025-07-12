const ConfigManager = require('../../src/config/ConfigManager');
const fs = require('fs');
const path = require('path');

/**
 * 文件监听器测试
 * 测试优化后的文件监听机制，包括防抖、错误处理和配置差异检测
 */
async function testFileWatcher() {
  console.log('开始测试文件监听器...');
  
  const configManager = ConfigManager.getInstance();
  
  try {
    // 初始化配置管理器并启用文件监听
    await configManager.initialize({
      env: 'development',
      enableWatcher: true
    });
    
    console.log('配置管理器初始化成功');
    
    // 监听配置重载事件
    configManager.on('configReloaded', (data) => {
      console.log('配置已重新加载:', {
        triggerFile: data.triggerFile,
        changesCount: data.changes.length,
        changes: data.changes
      });
    });
    
    // 监听配置重载错误事件
    configManager.on('configReloadError', (data) => {
      console.error('配置重载错误:', {
        triggerFile: data.triggerFile,
        error: data.error.message
      });
    });
    
    // 获取监听器状态
    const watcherStatus = configManager.getWatcherStatus();
    console.log('文件监听器状态:', JSON.stringify(watcherStatus, null, 2));
    
    // 测试配置文件修改
    console.log('\n准备测试配置文件修改...');
    
    const configPath = path.join(__dirname, '../../src/config/development.json');
    const originalConfig = fs.readFileSync(configPath, 'utf8');
    const configObj = JSON.parse(originalConfig);
    
    // 等待一下，确保监听器已经设置好
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('修改配置文件...');
    
    // 修改配置
    configObj.testValue = Date.now();
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    // 等待防抖和重载完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 再次修改配置（测试防抖）
    console.log('快速连续修改配置文件（测试防抖）...');
    configObj.testValue = Date.now() + 1;
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    configObj.testValue = Date.now() + 2;
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    configObj.testValue = Date.now() + 3;
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    // 等待防抖和重载完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 恢复原始配置
    console.log('恢复原始配置...');
    delete configObj.testValue;
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    // 等待最后一次重载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 获取最终监听器状态
    const finalWatcherStatus = configManager.getWatcherStatus();
    console.log('\n最终文件监听器状态:', JSON.stringify(finalWatcherStatus, null, 2));
    
    console.log('\n文件监听器测试完成');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  } finally {
    // 清理
    configManager.destroy();
  }
}

// 运行测试
if (require.main === module) {
  testFileWatcher().catch(console.error);
}

module.exports = { testFileWatcher };