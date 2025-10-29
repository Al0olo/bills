export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'development-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  payment: {
    serviceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001',
    apiKey: process.env.PAYMENT_SERVICE_API_KEY || 'development-api-key',
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'development-webhook-secret',
  },
  throttle: {
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute
  },
});

