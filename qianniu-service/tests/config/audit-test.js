const ConfigManager = require('../../src/config/ConfigManager');
const fs = require('fs');
const path = require('path');

/**
 * 审计日志测试
 * 测试配置管理器的审计日志功能
 */
async function testAuditLogging() {
  console.log('开始测试审计日志功能...');
  
  const configManager = ConfigManager.getInstance();
  
  try {
    // 初始化配置管理器
    await configManager.initialize({
      env: 'development'
    });
    
    console.log('✓ 配置验证通过');
    
    // 检查审计日志文件是否存在
    const auditLogPath = path.join(__dirname, '../../logs/config-audit.log');
    
    if (fs.existsSync(auditLogPath)) {
      console.log('✓ 审计日志文件存在:', auditLogPath);
      
      // 读取并显示日志内容
      const logContent = fs.readFileSync(auditLogPath, 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line.trim());
      
      console.log(`✓ 审计日志包含 ${logLines.length} 条记录`);
      
      if (logLines.length > 0) {
        console.log('最新的审计日志条目:');
        const latestLogs = logLines.slice(-3); // 显示最后3条
        latestLogs.forEach((line, index) => {
          try {
            const logEntry = JSON.parse(line);
            console.log(`  ${index + 1}. [${logEntry.timestamp}] ${logEntry.operation} - ${logEntry.action}`);
          } catch (e) {
            console.log(`  ${index + 1}. ${line}`);
          }
        });
      }
    } else {
      console.log('✗ 审计日志文件不存在:', auditLogPath);
      console.log('可能的原因:');
      console.log('  - 审计功能未启用');
      console.log('  - 日志目录权限问题');
      console.log('  - 日志写入失败');
    }
    
    // 检查logs目录
    const logsDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logsDir)) {
      console.log('✓ logs目录存在');
      const files = fs.readdirSync(logsDir);
      console.log('logs目录内容:', files);
    } else {
      console.log('✗ logs目录不存在');
    }
    
    // 测试配置获取（这会触发审计日志）
    console.log('\n测试配置获取...');
    const config = configManager.getAll();
    console.log('✓ 配置获取成功');
    
    // 等待一下让日志写入
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 再次检查日志文件
    if (fs.existsSync(auditLogPath)) {
      const newLogContent = fs.readFileSync(auditLogPath, 'utf8');
      const newLogLines = newLogContent.trim().split('\n').filter(line => line.trim());
      console.log(`✓ 审计日志现在包含 ${newLogLines.length} 条记录`);
    }
    
    console.log('\n审计日志测试完成');
    
  } catch (error) {
    console.error('✗ 测试过程中发生错误:', error.message);
    console.error('错误详情:', error);
  } finally {
    // 清理
    configManager.destroy();
  }
}

// 运行测试
if (require.main === module) {
  testAuditLogging().catch(console.error);
}

module.exports = { testAuditLogging };