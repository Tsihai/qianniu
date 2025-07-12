// Jest测试环境设置
process.env.NODE_ENV = 'test';
process.env.DB_MOCK_MODE = 'true';
process.env.SUPPRESS_JEST_WARNINGS = '1';

// 在测试环境中临时启用所有console输出以便调试
if (process.env.NODE_ENV === 'test') {
  // 保存原始的console方法
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  // 临时启用所有console输出用于调试
  // console.log = () => {};
  // console.info = () => {};
  // console.warn = () => {};
  // 保留console.error用于调试
  
  // 如果需要在特定测试中启用日志，可以使用：
  // console.log = originalConsole.log;
}

// 设置全局测试超时
// 注意：在ES模块中，jest.setTimeout应该在测试文件中单独设置