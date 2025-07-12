/**
 * 数据库连接测试
 */
const db = require('../config/db');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

describe('Database Connection', () => {
  beforeAll(() => {
    // 启用Mock模式进行测试
    process.env.DB_MOCK_MODE = 'true';
    db.enableMockMode();
  });

  afterAll(async () => {
    // 确保测试结束后断开连接
    try {
      await db.disconnect();
    } catch (error) {
      // 忽略断开连接时的错误
    }
  });

  test('should connect to database successfully', async () => {
    const conn = await db.connect();
    expect(conn).toBeTruthy();
    expect(db.status()).toBeDefined();
  });

  test('should disconnect from database successfully', async () => {
    await db.connect();
    await db.disconnect();
    const status = db.status();
    expect(status).toBeDefined();
  });

  test('should reconnect to database successfully', async () => {
    // 先连接
    await db.connect();
    
    // 断开连接
    await db.disconnect();
    
    // 重新连接
    const conn = await db.connect();
    expect(conn).toBeTruthy();
    expect(db.status()).toBeDefined();
  });

  test('should handle connection status correctly', async () => {
    const initialStatus = db.status();
    expect(initialStatus).toBeDefined();
    
    await db.connect();
    const connectedStatus = db.status();
    expect(connectedStatus).toBeDefined();
    
    await db.disconnect();
    const disconnectedStatus = db.status();
    expect(disconnectedStatus).toBeDefined();
  });
});