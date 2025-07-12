/**
 * Logger模块单元测试
 */

const fs = require('fs');
const path = require('path');
const {
  Logger,
  LoggerManager,
  LogFormatter,
  ConsoleAppender,
  FileAppender,
  LOG_LEVELS,
  getLogger,
  setGlobalLevel
} = require('../../utils/Logger');

// 测试用的临时目录
const TEST_LOG_DIR = path.join(__dirname, 'temp_logs');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'test.log');

describe('Logger System Tests', () => {
  
  beforeEach(() => {
    // 清理测试环境
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
  });
  
  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  });
  
  describe('LogFormatter', () => {
    const sampleLogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LOG_LEVELS.INFO,
      module: 'test',
      message: 'Test message',
      requestId: 'req-123',
      data: { key: 'value' },
      error: null
    };
    
    test('should format JSON correctly', () => {
      const result = LogFormatter.formatJSON(sampleLogEntry);
      expect(result).toBe(JSON.stringify(sampleLogEntry));
    });
    
    test('should format readable without colors', () => {
      const result = LogFormatter.formatReadable(sampleLogEntry, false);
      expect(result).toContain('[2024-01-01T00:00:00.000Z] INFO');
      expect(result).toContain('[test]');
      expect(result).toContain('[req-123]');
      expect(result).toContain('Test message');
      expect(result).toContain('Data: {"key":"value"}');
    });
    
    test('should format readable with colors', () => {
      const result = LogFormatter.formatReadable(sampleLogEntry, true);
      expect(result).toContain('\x1b[32m'); // 绿色
      expect(result).toContain('\x1b[0m');  // 重置
    });
    
    test('should format simple correctly', () => {
      const result = LogFormatter.formatSimple(sampleLogEntry);
      expect(result).toBe('[INFO] test: Test message {"key":"value"}');
    });
    
    test('should handle error in formatting', () => {
      const logEntryWithError = {
        ...sampleLogEntry,
        error: {
          message: 'Test error',
          stack: 'Error stack trace'
        }
      };
      
      const result = LogFormatter.formatReadable(logEntryWithError, false);
      expect(result).toContain('Error: Error stack trace');
    });
  });
  
  describe('ConsoleAppender', () => {
    let consoleSpy;
    
    beforeEach(() => {
      consoleSpy = {
        log: jest.spyOn(console, 'log').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation()
      };
    });
    
    afterEach(() => {
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });
    
    test('should log to console based on level', () => {
      const appender = new ConsoleAppender({ level: LOG_LEVELS.INFO });
      
      // 应该记录的日志
      appender.append({
        level: LOG_LEVELS.INFO,
        message: 'Info message',
        timestamp: new Date().toISOString()
      });
      expect(consoleSpy.log).toHaveBeenCalled();
      
      // 不应该记录的日志
      appender.append({
        level: LOG_LEVELS.DEBUG,
        message: 'Debug message',
        timestamp: new Date().toISOString()
      });
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });
    
    test('should use appropriate console method for different levels', () => {
      const appender = new ConsoleAppender({ level: LOG_LEVELS.DEBUG });
      
      appender.append({
        level: LOG_LEVELS.WARN,
        message: 'Warning',
        timestamp: new Date().toISOString()
      });
      expect(consoleSpy.warn).toHaveBeenCalled();
      
      appender.append({
        level: LOG_LEVELS.ERROR,
        message: 'Error',
        timestamp: new Date().toISOString()
      });
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });
  
  describe('FileAppender', () => {
    test('should create file and write logs', () => {
      const appender = new FileAppender({
        filePath: TEST_LOG_FILE,
        level: LOG_LEVELS.INFO
      });
      
      appender.append({
        level: LOG_LEVELS.INFO,
        message: 'Test message',
        timestamp: new Date().toISOString()
      });
      
      expect(fs.existsSync(TEST_LOG_FILE)).toBe(true);
      const content = fs.readFileSync(TEST_LOG_FILE, 'utf8');
      expect(content).toContain('Test message');
    });
    
    test('should respect log level', () => {
      const appender = new FileAppender({
        filePath: TEST_LOG_FILE,
        level: LOG_LEVELS.WARN
      });
      
      appender.append({
        level: LOG_LEVELS.INFO,
        message: 'Info message',
        timestamp: new Date().toISOString()
      });
      
      expect(fs.existsSync(TEST_LOG_FILE)).toBe(false);
    });
    
    test('should throw error if filePath not provided', () => {
      expect(() => {
        new FileAppender({});
      }).toThrow('filePath is required for FileAppender');
    });
  });
  
  describe('Logger', () => {
    let logger;
    
    beforeEach(() => {
      logger = new Logger({
        module: 'test',
        level: LOG_LEVELS.DEBUG,
        console: false // 禁用控制台输出以避免测试干扰
      });
    });
    
    test('should create log entries with correct structure', () => {
      const logEntry = logger.createLogEntry(
        LOG_LEVELS.INFO,
        'Test message',
        { key: 'value' }
      );
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('level', LOG_LEVELS.INFO);
      expect(logEntry).toHaveProperty('module', 'test');
      expect(logEntry).toHaveProperty('message', 'Test message');
      expect(logEntry).toHaveProperty('data');
      expect(logEntry.data).toHaveProperty('key', 'value');
    });
    
    test('should set and use context', () => {
      logger.setContext({
        requestId: 'req-123',
        userId: 'user-456'
      });
      
      const logEntry = logger.createLogEntry(LOG_LEVELS.INFO, 'Test');
      expect(logEntry.requestId).toBe('req-123');
      expect(logEntry.userId).toBe('user-456');
    });
    
    test('should clear context', () => {
      logger.setContext({ requestId: 'req-123' });
      logger.clearContext();
      
      const logEntry = logger.createLogEntry(LOG_LEVELS.INFO, 'Test');
      expect(logEntry.requestId).toBeUndefined();
    });
    
    test('should provide convenience methods', () => {
      const mockAppender = {
        shouldLog: () => true,
        append: jest.fn()
      };
      logger.addAppender(mockAppender);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      logger.fatal('Fatal message');
      
      expect(mockAppender.append).toHaveBeenCalledTimes(5);
    });
    
    test('should create child logger with inherited context', () => {
      logger.setContext({ parentData: 'value' });
      
      const childLogger = logger.child({
        module: 'child',
        context: { childData: 'childValue' }
      });
      
      const logEntry = childLogger.createLogEntry(LOG_LEVELS.INFO, 'Test');
      expect(logEntry.module).toBe('child');
      expect(logEntry.data.parentData).toBe('value');
      expect(logEntry.data.childData).toBe('childValue');
    });
    
    test('should handle console compatibility method', () => {
      const mockAppender = {
        shouldLog: () => true,
        append: jest.fn()
      };
      logger.addAppender(mockAppender);
      
      logger.console('Test', { key: 'value' }, 123);
      
      expect(mockAppender.append).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LOG_LEVELS.INFO,
          message: 'Test {"key":"value"} 123'
        })
      );
    });
  });
  
  describe('LoggerManager', () => {
    let manager;
    
    beforeEach(() => {
      manager = new LoggerManager();
    });
    
    test('should create and cache loggers', () => {
      const logger1 = manager.getLogger('test');
      const logger2 = manager.getLogger('test');
      
      expect(logger1).toBe(logger2); // 应该是同一个实例
    });
    
    test('should create different loggers for different modules', () => {
      const logger1 = manager.getLogger('module1');
      const logger2 = manager.getLogger('module2');
      
      expect(logger1).not.toBe(logger2);
      expect(logger1.module).toBe('module1');
      expect(logger2.module).toBe('module2');
    });
    
    test('should set default config', () => {
      manager.setDefaultConfig({
        level: LOG_LEVELS.ERROR,
        useColors: false
      });
      
      const logger = manager.getLogger('test');
      expect(logger.level).toBe(LOG_LEVELS.ERROR);
    });
    
    test('should set global level', () => {
      const logger1 = manager.getLogger('test1');
      const logger2 = manager.getLogger('test2');
      
      manager.setGlobalLevel(LOG_LEVELS.ERROR);
      
      expect(logger1.level).toBe(LOG_LEVELS.ERROR);
      expect(logger2.level).toBe(LOG_LEVELS.ERROR);
    });
    
    test('should clear all loggers', () => {
      manager.getLogger('test1');
      manager.getLogger('test2');
      
      manager.clear();
      
      const newLogger = manager.getLogger('test1');
      expect(newLogger).toBeDefined();
    });
  });
  
  describe('Global Functions', () => {
    test('getLogger should work', () => {
      const logger = getLogger('global-test');
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.module).toBe('global-test');
    });
    
    test('setGlobalLevel should work', () => {
      const logger = getLogger('level-test');
      setGlobalLevel(LOG_LEVELS.ERROR);
      expect(logger.level).toBe(LOG_LEVELS.ERROR);
    });
  });
  
  describe('Integration Tests', () => {
    test('should work with file appender in real scenario', () => {
      const logger = new Logger({
        module: 'integration',
        console: false,
        file: {
          path: TEST_LOG_FILE,
          format: 'json'
        }
      });
      
      logger.setContext({ requestId: 'req-integration' });
      logger.info('Integration test message', { testData: true });
      logger.error('Integration error', { errorData: 'test' }, new Error('Test error'));
      
      expect(fs.existsSync(TEST_LOG_FILE)).toBe(true);
      
      const content = fs.readFileSync(TEST_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(2);
      
      const infoLog = JSON.parse(lines[0]);
      expect(infoLog.level).toBe(LOG_LEVELS.INFO);
      expect(infoLog.message).toBe('Integration test message');
      expect(infoLog.requestId).toBe('req-integration');
      expect(infoLog.data.testData).toBe(true);
      
      const errorLog = JSON.parse(lines[1]);
      expect(errorLog.level).toBe(LOG_LEVELS.ERROR);
      expect(errorLog.message).toBe('Integration error');
      expect(errorLog.error.message).toBe('Test error');
    });
    
    test('should handle multiple appenders', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const logger = new Logger({
        module: 'multi-appender',
        console: true,
        file: {
          path: TEST_LOG_FILE,
          format: 'json'
        }
      });
      
      logger.info('Multi appender test');
      
      // 检查控制台输出
      expect(consoleSpy).toHaveBeenCalled();
      
      // 检查文件输出
      expect(fs.existsSync(TEST_LOG_FILE)).toBe(true);
      const content = fs.readFileSync(TEST_LOG_FILE, 'utf8');
      expect(content).toContain('Multi appender test');
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle appender errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const faultyAppender = {
        shouldLog: () => true,
        append: () => {
          throw new Error('Appender error');
        }
      };
      
      const logger = new Logger({ module: 'error-test', console: false });
      logger.addAppender(faultyAppender);
      
      // 不应该抛出异常
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Appender error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
    
    test('should handle file write errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const appender = new FileAppender({
        filePath: '/invalid/path/test.log', // 无效路径
        level: LOG_LEVELS.INFO
      });
      
      // 不应该抛出异常
      expect(() => {
        appender.append({
          level: LOG_LEVELS.INFO,
          message: 'Test',
          timestamp: new Date().toISOString()
        });
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write log to file:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});