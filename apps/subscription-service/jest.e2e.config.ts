import baseConfig from './jest.config';

export default {
  ...baseConfig,
  displayName: 'subscription-service:e2e',
  testMatch: ['**/*.e2e-spec.ts'],
  testTimeout: 60000, // E2E tests may take longer
};

