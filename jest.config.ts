export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/**/*.spec.ts',
    '<rootDir>/apps/backend/src/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { isolatedModules: true, tsconfig: '<rootDir>/tsconfig.base.json' },
    ],
  },
  moduleNameMapper: {
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
  },
};
