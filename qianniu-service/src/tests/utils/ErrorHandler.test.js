/**
 * ErrorHandler 单元测试
 */

const { ErrorHandler, CustomError, ERROR_CODES } = require('../../utils/ErrorHandler');

describe('ErrorHandler', () => {
  describe('CustomError', () => {
    test('should create custom error with code and message', () => {
      const error = new CustomError(
        ERROR_CODES.INVALID_PARAMETER,
        'Test error message',
        { parameter: 'testParam' }
      );
      
      expect(error.name).toBe('CustomError');
      expect(error.code).toBe(ERROR_CODES.INVALID_PARAMETER);
      expect(error.message).toBe('Test error message');
      expect(error.details.parameter).toBe('testParam');
      expect(error.timestamp).toBeDefined();
    });
    
    test('should format message with details', () => {
      const error = ErrorHandler.createError(
        ERROR_CODES.INVALID_PARAMETER,
        { parameter: 'username' }
      );
      
      expect(error.message).toContain('username');
    });
    
    test('should convert to JSON', () => {
      const error = new CustomError(
        ERROR_CODES.INVALID_PARAMETER,
        'Test message',
        { test: 'data' }
      );
      
      const json = error.toJSON();
      expect(json.name).toBe('CustomError');
      expect(json.code).toBe(ERROR_CODES.INVALID_PARAMETER);
      expect(json.message).toBe('Test message');
      expect(json.details.test).toBe('data');
      expect(json.timestamp).toBeDefined();
    });
  });
  
  describe('createError', () => {
    test('should create error with predefined message', () => {
      const error = ErrorHandler.createError(
        ERROR_CODES.WEBSOCKET_CONNECTION_FAILED,
        { reason: 'Network timeout' }
      );
      
      expect(error.code).toBe(ERROR_CODES.WEBSOCKET_CONNECTION_FAILED);
      expect(error.message).toContain('Network timeout');
    });
    
    test('should use unknown error for invalid code', () => {
      const error = ErrorHandler.createError('INVALID_CODE');
      expect(error.message).toContain('未知错误');
    });
  });
  
  describe('formatMessage', () => {
    test('should replace placeholders with parameters', () => {
      const template = 'Error in {module} with {parameter}';
      const params = { module: 'websocket', parameter: 'clientId' };
      
      const result = ErrorHandler.formatMessage(template, params);
      expect(result).toBe('Error in websocket with clientId');
    });
    
    test('should keep unreplaced placeholders', () => {
      const template = 'Error in {module} with {missing}';
      const params = { module: 'websocket' };
      
      const result = ErrorHandler.formatMessage(template, params);
      expect(result).toBe('Error in websocket with {missing}');
    });
  });
  
  describe('wrapError', () => {
    test('should wrap native error', () => {
      const nativeError = new Error('Native error message');
      const wrappedError = ErrorHandler.wrapError(
        nativeError,
        ERROR_CODES.MESSAGE_PROCESSING_ERROR,
        { context: 'test' }
      );
      
      expect(wrappedError).toBeInstanceOf(CustomError);
      expect(wrappedError.code).toBe(ERROR_CODES.MESSAGE_PROCESSING_ERROR);
      expect(wrappedError.details.originalMessage).toBe('Native error message');
      expect(wrappedError.originalError).toBe(nativeError);
    });
    
    test('should return CustomError as-is', () => {
      const customError = new CustomError(ERROR_CODES.INVALID_PARAMETER, 'Test');
      const result = ErrorHandler.wrapError(customError);
      
      expect(result).toBe(customError);
    });
  });
  
  describe('safeExecute', () => {
    test('should execute function successfully', () => {
      const fn = () => 'success';
      const result = ErrorHandler.safeExecute(fn);
      
      expect(result).toBe('success');
    });
    
    test('should wrap thrown error', () => {
      const fn = () => {
        throw new Error('Test error');
      };
      
      expect(() => {
        ErrorHandler.safeExecute(fn, ERROR_CODES.MESSAGE_PROCESSING_ERROR);
      }).toThrow(CustomError);
    });
    
    test('should handle Promise rejection', async () => {
      const fn = () => Promise.reject(new Error('Async error'));
      
      await expect(
        ErrorHandler.safeExecute(fn, ERROR_CODES.MESSAGE_PROCESSING_ERROR)
      ).rejects.toThrow(CustomError);
    });
  });
  
  describe('safeExecuteAsync', () => {
    test('should execute async function successfully', async () => {
      const asyncFn = async () => 'async success';
      const result = await ErrorHandler.safeExecuteAsync(asyncFn);
      
      expect(result).toBe('async success');
    });
    
    test('should wrap async error', async () => {
      const asyncFn = async () => {
        throw new Error('Async error');
      };
      
      await expect(
        ErrorHandler.safeExecuteAsync(asyncFn, ERROR_CODES.BUSINESS_LOGIC_ERROR)
      ).rejects.toThrow(CustomError);
    });
  });
  
  describe('isErrorType', () => {
    test('should identify error type correctly', () => {
      const error = ErrorHandler.createError(ERROR_CODES.INVALID_PARAMETER);
      
      expect(ErrorHandler.isErrorType(error, ERROR_CODES.INVALID_PARAMETER)).toBe(true);
      expect(ErrorHandler.isErrorType(error, ERROR_CODES.UNKNOWN_ERROR)).toBe(false);
    });
    
    test('should return false for native errors', () => {
      const nativeError = new Error('Native error');
      
      expect(ErrorHandler.isErrorType(nativeError, ERROR_CODES.INVALID_PARAMETER)).toBe(false);
    });
  });
  
  describe('getErrorSeverity', () => {
    test('should return correct severity levels', () => {
      const criticalError = ErrorHandler.createError(ERROR_CODES.WEBSOCKET_CONNECTION_FAILED);
      const highError = ErrorHandler.createError(ERROR_CODES.MESSAGE_PROCESSING_ERROR);
      const lowError = ErrorHandler.createError(ERROR_CODES.INVALID_PARAMETER);
      const mediumError = ErrorHandler.createError(ERROR_CODES.UNKNOWN_ERROR);
      
      expect(ErrorHandler.getErrorSeverity(criticalError)).toBe('critical');
      expect(ErrorHandler.getErrorSeverity(highError)).toBe('high');
      expect(ErrorHandler.getErrorSeverity(lowError)).toBe('low');
      expect(ErrorHandler.getErrorSeverity(mediumError)).toBe('medium');
    });
    
    test('should return medium for native errors', () => {
      const nativeError = new Error('Native error');
      expect(ErrorHandler.getErrorSeverity(nativeError)).toBe('medium');
    });
  });
  
  describe('createErrorResponse', () => {
    test('should create error response object', () => {
      const error = ErrorHandler.createError(
        ERROR_CODES.INVALID_PARAMETER,
        { parameter: 'test' }
      );
      
      const response = ErrorHandler.createErrorResponse(error);
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_CODES.INVALID_PARAMETER);
      expect(response.error.message).toBeDefined();
      expect(response.error.severity).toBe('low');
      expect(response.error.timestamp).toBeDefined();
      expect(response.error.details).toEqual({ parameter: 'test' });
      expect(response.error.stack).toBeUndefined();
    });
    
    test('should include stack when requested', () => {
      const error = ErrorHandler.createError(ERROR_CODES.INVALID_PARAMETER);
      const response = ErrorHandler.createErrorResponse(error, true);
      
      expect(response.error.stack).toBeDefined();
    });
    
    test('should handle native errors', () => {
      const nativeError = new Error('Native error');
      const response = ErrorHandler.createErrorResponse(nativeError);
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(response.error.message).toBe('Native error');
    });
  });
});