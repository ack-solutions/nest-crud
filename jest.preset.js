/**
 * Shared Jest preset for the monorepo packages.
 * Each package's jest.config.ts sets its own displayName, coverageDirectory,
 * and ts-jest tsconfig, and inherits the common defaults below.
 */
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'html', 'json'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/tests/**',
    '!src/test/**',
  ],
};
