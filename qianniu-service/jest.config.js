export default {
  testEnvironment: 'node',
  testTimeout: 30000,
  extensionsToTreatAsEsm: ['.js'],
  transform: {},
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1'
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '<rootDir>/src/tests/**/*.test.js'
  ],
  verbose: true,
  silent: false
};