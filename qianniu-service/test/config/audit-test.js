const ConfigManager = require('../../src/config/ConfigManager');
const fs = require('fs');
const path = require('path');

/**
 * 配置管理器审计日志功能测试
 */
async function testConfigAudit() {
  console.log('开始测试配置管理器审计日志功能...');
  
  try {
    // 获取ConfigManager实例
    const configManager = ConfigManager.getInstance();
    
    // 初始化配置管理器
    await configManager.initialize({
      env: 'development',
      configDir: path.join(__dirname, '../../src/config'),
      enableWatcher: false
    });
    
    console.log('✓ 配置管理器初始化成功');
    
    // 测试读取配置
    console.log('\n测试配置读取...');
    const serverPort = configManager.get('server.port', 3000);
    console.log(`服务器端口: ${serverPort}`);
    
    const dbHost = configManager.get('database.host', 'localhost');
    console.log(`数据库主机: ${dbHost}`);
    
    // 测试设置配置
    console.log('\n测试配置设置...');
    configManager.set('test.auditValue', 'test-audit-value');
    configManager.set('test.timestamp', new Date().toISOString());
    
    // 测试读取刚设置的配置
    const auditValue = configManager.get('test.auditValue');
    console.log(`审计测试值: ${auditValue}`);
    
    // 测试修改现有配置
    configManager.set('test.auditValue', 'modified-audit-value');
    
    // 测试配置验证（如果有schema）
    console.log('\n测试配置验证...');
    try {
      await configManager.validateConfiguration();
      console.log('✓ 配置验证通过');
    } catch (error) {
      console.log(`配置验证失败: ${error.message}`);
    }
    
    // 等待一段时间确保日志写入
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查审计日志文件
    const auditLogPath = path.join(process.cwd(), 'logs', 'config-audit.log');
    console.log(`\n检查审计日志文件: ${auditLogPath}`);
    
    if (fs.existsSync(auditLogPath)) {
      const logContent = fs.readFileSync(auditLogPath, 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line.trim());
      
      console.log(`✓ 审计日志文件存在，包含 ${logLines.length} 条记录`);
      
      // 显示最近的几条日志
      console.log('\n最近的审计日志记录:');
      logLines.slice(-5).forEach((line, index) => {
        try {
          const logEntry = JSON.parse(line);
          console.log(`${index + 1}. ${logEntry.timestamp} - ${logEntry.operation} - ${logEntry.configPath}`);
        } catch (error) {
          console.log(`${index + 1}. ${line}`);
        }
      });
    } else {
      console.log('⚠ 审计日志文件不存在，可能审计功能未启用或日志写入失败');
    }
    
    console.log('\n✓ 审计日志功能测试完成');
    
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testConfigAudit().then(() => {
    console.log('\n测试结束');
    process.exit(0);
  }).catch(error => {
    console.error('测试异常:', error);
    process.exit(1);
  });
}

module.exports = { testConfigAudit };