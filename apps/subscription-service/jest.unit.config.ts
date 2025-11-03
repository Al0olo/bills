import baseConfig from './jest.config';

export default {
  ...baseConfig,
  displayName: 'subscription-service:unit',
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '\\.integration\\.spec\\.ts$',
    '\\.e2e-spec\\.ts$',
  ],
};

