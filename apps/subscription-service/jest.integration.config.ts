import baseConfig from './jest.config';

export default {
  ...baseConfig,
  displayName: 'subscription-service:integration',
  testMatch: ['**/*.integration.spec.ts'],
  testTimeout: 60000, // Integration tests may take longer
  maxWorkers: 1, // Run tests serially to avoid database conflicts
};

