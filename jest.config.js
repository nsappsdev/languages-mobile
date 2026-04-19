module.exports = {
  preset: 'jest-expo',
  coverageProvider: 'v8',
  moduleDirectories: ['node_modules', 'node_modules/expo/node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
