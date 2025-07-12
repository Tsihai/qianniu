/**
 * 数据库配置与连接管理
 * 提供MongoDB数据库连接服务
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 数据库连接配置
 */
const config = {
  // 连接URI，优先使用环境变量，否则使用默认本地连接
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/qianniu',
  
  // Mongoose连接选项
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  }
};

// 创建连接实例
const connection = {
  // 连接状态
  _mockMode: process.env.DB_MOCK_MODE === 'true' || false,
  _connected: false,
  _instance: null
};

/**
 * 连接数据库
 * @returns {Promise} 连接结果Promise
 */
connection.connect = async () => {
  try {
    // 如果已连接，直接返回连接实例
    if (mongoose.connection.readyState === 1) {
      console.log('数据库已连接');
      connection._connected = true;
      connection._instance = mongoose.connection;
      return mongoose.connection;
    }

    // 如果是mock模式，不实际连接数据库
    if (connection._mockMode) {
      console.log('数据库使用Mock模式');
      connection._connected = true;
      return { mockConnection: true };
    }

    console.log(`正在连接数据库: ${config.uri}`);
    await mongoose.connect(config.uri, config.options);
    
    console.log('数据库连接成功');
    connection._connected = true;
    connection._instance = mongoose.connection;
    
    // 监听连接事件
    mongoose.connection.on('error', err => {
      console.error('数据库连接错误:', err);
      connection._connected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('数据库连接断开');
      connection._connected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('数据库重新连接成功');
      connection._connected = true;
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('数据库连接失败:', error);
    connection._connected = false;
    throw error;
  }
};

/**
 * 断开数据库连接
 * @returns {Promise} 断开结果Promise
 */
connection.disconnect = async () => {
  // 如果是mock模式，直接返回
  if (connection._mockMode) {
    connection._connected = false;
    return true;
  }
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    connection._connected = false;
    console.log('数据库连接已断开');
    return true;
  }
  return true;
};

/**
 * 获取连接状态
 * @returns {Object} 连接状态
 */
connection.status = () => {
  // 如果是mock模式，返回mock状态
  if (connection._mockMode) {
    return { 
      connected: connection._connected, 
      state: 'mock', 
      mockMode: true 
    };
  }
  
  return {
    connected: connection._connected,
    state: ['断开', '已连接', '连接中', '断开中'][mongoose.connection.readyState] || '未知',
    readyState: mongoose.connection.readyState
  };
};

/**
 * 启用Mock模式
 */
connection.enableMockMode = () => {
  connection._mockMode = true;
  console.log('数据库已启用Mock模式');
};

/**
 * 禁用Mock模式
 */
connection.disableMockMode = () => {
  connection._mockMode = false;
  console.log('数据库已禁用Mock模式');
};

export default connection;