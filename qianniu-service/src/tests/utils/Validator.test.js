/**
 * Validator 单元测试
 */

const { Validator, ValidationResult } = require('../../utils/Validator');
const { ERROR_CODES } = require('../../utils/ErrorHandler');

describe('Validator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new Validator();
  });
  
  describe('ValidationResult', () => {
    test('should initialize with valid state', () => {
      const result = new ValidationResult();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
    
    test('should add error and mark as invalid', () => {
      const result = new ValidationResult();
      result.addError('testField', 'Test error message', 'TEST_ERROR');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'testField',
        message: 'Test error message',
        code: 'TEST_ERROR'
      });
    });
    
    test('should add warning without affecting validity', () => {
      const result = new ValidationResult();
      result.addWarning('testField', 'Test warning');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        field: 'testField',
        message: 'Test warning'
      });
    });
    
    test('should get first error', () => {
      const result = new ValidationResult();
      result.addError('field1', 'Error 1');
      result.addError('field2', 'Error 2');
      
      const firstError = result.getFirstError();
      expect(firstError.field).toBe('field1');
      expect(firstError.message).toBe('Error 1');
    });
    
    test('should throw error when invalid', () => {
      const result = new ValidationResult();
      result.addError('testField', 'Test error');
      
      expect(() => result.throwIfInvalid()).toThrow();
    });
    
    test('should not throw when valid', () => {
      const result = new ValidationResult();
      expect(() => result.throwIfInvalid()).not.toThrow();
    });
  });
  
  describe('FieldValidator - Basic Types', () => {
    test('should validate required fields', () => {
      validator.field(null, 'testField').required();
      validator.field(undefined, 'testField2').required();
      validator.field('', 'testField3').required();
      validator.field('valid', 'testField4').required();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
    
    test('should validate string type', () => {
      validator.field('valid string', 'stringField').string();
      validator.field(123, 'numberField').string();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('numberField');
    });
    
    test('should validate number type', () => {
      validator.field(123, 'numberField').number();
      validator.field('123', 'stringField').number();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('stringField');
    });
    
    test('should validate boolean type', () => {
      validator.field(true, 'boolField').boolean();
      validator.field('true', 'stringField').boolean();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
    
    test('should validate object type', () => {
      validator.field({}, 'objectField').object();
      validator.field([], 'arrayField').object();
      validator.field(null, 'nullField').object();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
    
    test('should validate array type', () => {
      validator.field([], 'arrayField').array();
      validator.field({}, 'objectField').array();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
  
  describe('FieldValidator - String Validations', () => {
    test('should validate minimum length', () => {
      validator.field('abc', 'field1').minLength(5);
      validator.field('abcdef', 'field2').minLength(5);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('field1');
    });
    
    test('should validate maximum length', () => {
      validator.field('abcdef', 'field1').maxLength(5);
      validator.field('abc', 'field2').maxLength(5);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('field1');
    });
    
    test('should validate email format', () => {
      validator.field('test@example.com', 'validEmail').email();
      validator.field('invalid-email', 'invalidEmail').email();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('invalidEmail');
    });
    
    test('should validate URL format', () => {
      validator.field('https://example.com', 'validUrl').url();
      validator.field('invalid-url', 'invalidUrl').url();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('invalidUrl');
    });
    
    test('should validate pattern', () => {
      const phonePattern = /^\d{3}-\d{3}-\d{4}$/;
      validator.field('123-456-7890', 'validPhone').pattern(phonePattern);
      validator.field('invalid-phone', 'invalidPhone').pattern(phonePattern);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('invalidPhone');
    });
  });
  
  describe('FieldValidator - Number Validations', () => {
    test('should validate minimum value', () => {
      validator.field(10, 'field1').min(5);
      validator.field(3, 'field2').min(5);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('field2');
    });
    
    test('should validate maximum value', () => {
      validator.field(3, 'field1').max(5);
      validator.field(10, 'field2').max(5);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('field2');
    });
  });
  
  describe('FieldValidator - Advanced Validations', () => {
    test('should validate enum values', () => {
      const allowedValues = ['red', 'green', 'blue'];
      validator.field('red', 'validColor').enum(allowedValues);
      validator.field('yellow', 'invalidColor').enum(allowedValues);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('invalidColor');
    });
    
    test('should validate with custom function', () => {
      const isEven = (value) => value % 2 === 0;
      
      validator.field(4, 'evenNumber').custom(isEven);
      validator.field(5, 'oddNumber').custom(isEven);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('oddNumber');
    });
    
    test('should handle custom validation errors', () => {
      const throwingValidator = () => {
        throw new Error('Custom validation error');
      };
      
      validator.field('test', 'testField').custom(throwingValidator);
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Custom validation error');
    });
    
    test('should support conditional validation', () => {
      validator.field('test', 'conditionalField')
        .when(true, (v) => v.minLength(10))
        .when(false, (v) => v.minLength(1));
      
      const result = validator.getResult();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
  
  describe('FieldValidator - Chain Validation', () => {
    test('should chain multiple validations', () => {
      validator.field('test@example.com', 'email')
        .required()
        .string()
        .email();
      
      const result = validator.getResult();
      expect(result.isValid).toBe(true);
    });
    
    test('should stop validation on first error', () => {
      validator.field(null, 'testField')
        .required()
        .string()
        .minLength(5);
      
      const result = validator.getResult();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('REQUIRED');
    });
  });
  
  describe('Batch Validation', () => {
    test('should validate object with rules', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        age: 25
      };
      
      const rules = {
        name: (v) => v.required().string().minLength(2),
        email: (v) => v.required().email(),
        age: (v) => v.required().number().min(18)
      };
      
      const result = validator.validate(data, rules);
      expect(result.isValid).toBe(true);
    });
    
    test('should validate with multiple errors', () => {
      const data = {
        name: '',
        email: 'invalid-email',
        age: 15
      };
      
      const rules = {
        name: (v) => v.required().string(),
        email: (v) => v.required().email(),
        age: (v) => v.required().number().min(18)
      };
      
      const result = validator.validate(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
    
    test('should support rule arrays', () => {
      const data = { field: 'test' };
      const rules = {
        field: [
          (v) => v.required(),
          (v) => v.string(),
          (v) => v.minLength(10)
        ]
      };
      
      const result = validator.validate(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
  
  describe('Static Methods', () => {
    test('should validate using static method', () => {
      const data = { name: 'John' };
      const rules = { name: (v) => v.required().string() };
      
      const result = Validator.validate(data, rules);
      expect(result.isValid).toBe(true);
    });
    
    test('should validate and throw using static method', () => {
      const data = { name: '' };
      const rules = { name: (v) => v.required() };
      
      expect(() => {
        Validator.validateAndThrow(data, rules);
      }).toThrow();
    });
  });
  
  describe('Predefined Rules', () => {
    test('should use predefined rules', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
        active: true
      };
      
      const rules = {
        name: Validator.rules.requiredString,
        email: Validator.rules.email,
        age: Validator.rules.requiredNumber,
        active: Validator.rules.boolean
      };
      
      const result = Validator.validate(data, rules);
      expect(result.isValid).toBe(true);
    });
    
    test('should use factory rules', () => {
      const data = {
        password: 'short',
        score: 150
      };
      
      const rules = {
        password: Validator.rules.minLength(8),
        score: Validator.rules.max(100)
      };
      
      const result = Validator.validate(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
  
  describe('Reset Functionality', () => {
    test('should reset validator state', () => {
      validator.field('', 'testField').required();
      expect(validator.getResult().isValid).toBe(false);
      
      validator.reset();
      expect(validator.getResult().isValid).toBe(true);
      expect(validator.getResult().errors).toHaveLength(0);
    });
  });
});