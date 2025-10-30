export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  database: {
    url: process.env.DATABASE_URL,
  },

  apiKey: process.env.API_KEY || 'payment-service-api-key',

  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'webhook-secret',
    subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_WEBHOOK_URL || 'http://localhost:3000/v1/webhooks/payment',
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '1000', 10),
  },

  simulation: {
    successRate: parseInt(process.env.PAYMENT_SUCCESS_RATE || '80', 10),
    processingDelayMs: parseInt(process.env.PAYMENT_PROCESSING_DELAY_MS || '2000', 10),
    minDelayMs: parseInt(process.env.PAYMENT_MIN_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.PAYMENT_MAX_DELAY_MS || '5000', 10),
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  },
});

