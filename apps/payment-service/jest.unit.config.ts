import baseConfig from './jest.config';

export default {
  ...baseConfig,
  displayName: 'payment-service:unit',
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '\\.integration\\.spec\\.ts$',
    '\\.e2e-spec\\.ts$',
  ],
};

