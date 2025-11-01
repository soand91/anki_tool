/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Make paths unambiguous
  rootDir: '.',
  roots: ['<rootDir>/src/main/state'],
  testMatch: ['**/*.test.ts'],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },

  clearMocks: true,
  coveragePathIgnorePatterns: ['/node_modules/'],
};
