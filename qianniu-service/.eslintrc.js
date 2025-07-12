export default {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 代码质量规则
    'prefer-const': 'error',
    'no-unused-vars': 'warn',
    'no-console': 'off', // 允许console.log用于调试
    'no-debugger': 'error',
    
    // 代码风格规则
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // ES6+ 规则
    'arrow-spacing': 'error',
    'template-curly-spacing': 'error',
    'object-shorthand': 'error',
    
    // Node.js 特定规则
    'no-process-exit': 'error',
    'handle-callback-err': 'error'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.min.js'
  ]
};