# System Architecture Documentation

## Overview

This document describes the system architecture for the microservices-based subscription billing system. The system consists of two independent microservices that communicate via HTTP APIs and webhooks.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                          │
│                  (Web App, Mobile App, API Clients)                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS/REST API
                             │ (JWT Authentication)
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
         ▼                                       ▼
┌─────────────────────┐              ┌─────────────────────┐
│  SUBSCRIPTION       │              │   PAYMENT           │
│  SERVICE            │◄────────────►│   GATEWAY           │
│  (Port 3000)        │   Webhooks   │   SERVICE           │
│                     │              │   (Port 3001)       │
└──────────┬──────────┘              └──────────┬──────────┘
           │                                    │
           │                                    │
           ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│  PostgreSQL DB      │              │  PostgreSQL DB      │
│  subscriptions_db   │              │  payments_db        │
└─────────────────────┘              └─────────────────────┘
```

---

## Service Descriptions

### Subscription Service (Port 3000)

**Responsibilities:**
- User management (CRUD operations)
- Subscription plan management
- Subscription lifecycle management
- Webhook receiver for payment updates
- Business logic for subscription state transitions

**Technology Stack:**
- NestJS framework
- Prisma ORM
- PostgreSQL database
- JWT for authentication
- Swagger for API documentation

**Database:** `subscriptions_db`

---

### Payment Gateway Service (Port 3001)

**Responsibilities:**
- Payment transaction processing (simulated)
- Payment status tracking
- Webhook delivery to Subscription Service
- Configurable success/failure rates

**Technology Stack:**
- NestJS framework
- Prisma ORM
- PostgreSQL database
- Webhook retry mechanism
- Swagger for API documentation

**Database:** `payments_db`

---

## API Versioning Strategy

### URL-Based Versioning

All API endpoints include version in the URL path:

```
/v1/users
/v1/subscriptions
/v1/payments
```

**Benefits:**
- Clear and explicit versioning
- Easy to route different versions
- Backward compatibility maintained
- Simple for clients to understand

**Version Management:**
- Start with `v1` for initial release
- Create new version (`v2`) when breaking changes needed
- Maintain old versions for deprecation period (6-12 months)
- Document migration guides for version upgrades

**Example Version Transition:**
```typescript
// v1 - Original endpoint
GET /v1/subscriptions/:id
Response: { id, userId, planId, status }

// v2 - Enhanced endpoint with additional fields
GET /v2/subscriptions/:id
Response: { id, userId, planId, status, metadata, tags }
```

---

## Service Communication Patterns

### 1. Synchronous Communication (HTTP REST)

**Subscription Service → Payment Service**

```
POST /v1/payments/initiate
Content-Type: application/json
Authorization: Bearer {service_token}
Idempotency-Key: {unique_key}

{
  "externalReference": "sub_12345",
  "amount": 29.99,
  "currency": "USD",
  "metadata": {
    "userId": "user_123",
    "planId": "plan_456"
  }
}
```

**Response:**
```json
{
  "id": "pay_789",
  "externalReference": "sub_12345",
  "status": "pending",
  "amount": 29.99,
  "currency": "USD",
  "createdAt": "2025-10-29T12:00:00Z"
}
```

---

### 2. Asynchronous Communication (Webhooks)

**Payment Service → Subscription Service**

```
POST /v1/webhooks/payment
Content-Type: application/json
X-Webhook-Signature: {hmac_signature}
Idempotency-Key: {webhook_id}

{
  "eventType": "payment.completed",
  "paymentId": "pay_789",
  "externalReference": "sub_12345",
  "status": "success",
  "amount": 29.99,
  "currency": "USD",
  "timestamp": "2025-10-29T12:01:00Z"
}
```

**Response:**
```json
{
  "received": true,
  "processedAt": "2025-10-29T12:01:01Z"
}
```

---

## Webhook Flow and Retry Mechanism

### Webhook Delivery Flow

```
┌─────────────────┐
│ Payment Service │
│                 │
│ 1. Process      │
│    Payment      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. Create Webhook Event     │
│    - Generate unique ID     │
│    - Store in database      │
│    - Set status: PENDING    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. Send Webhook             │
│    - HTTP POST request      │
│    - Include signature      │
│    - Include idempotency    │
│    - Timeout: 10 seconds    │
└────────┬────────────────────┘
         │
         ├─────► Success (200/201)
         │       └──► Mark as DELIVERED
         │
         └─────► Failure (4xx/5xx/timeout)
                 └──► Schedule Retry
```

### Retry Strategy

**Exponential Backoff with Jitter:**

| Attempt | Delay      | Total Time Elapsed |
|---------|------------|-------------------|
| 1       | Immediate  | 0s                |
| 2       | 30s        | 30s               |
| 3       | 2 min      | 2.5 min           |
| 4       | 10 min     | 12.5 min          |
| 5       | 30 min     | 42.5 min          |
| 6       | 1 hour     | 1h 42.5 min       |

**Retry Logic:**
```typescript
async function retryWebhook(webhookId: string, attempt: number) {
  const delays = [0, 30, 120, 600, 1800, 3600]; // seconds
  const maxAttempts = 6;
  
  if (attempt > maxAttempts) {
    await markWebhookAsFailed(webhookId);
    await notifyAdministrators(webhookId);
    return;
  }
  
  const delay = delays[attempt - 1];
  const jitter = Math.random() * 1000; // 0-1000ms jitter
  
  await sleep(delay * 1000 + jitter);
  await sendWebhook(webhookId);
}
```

**Failure Handling:**
- After 6 failed attempts, mark webhook as FAILED
- Store failure reason and last error message
- Send alert to monitoring system
- Allow manual retry from admin panel

---

## Idempotency Implementation

### Idempotency Key Structure

**Client-Generated Keys:**
```
Format: {prefix}_{timestamp}_{uuid}
Example: sub_1698765432_550e8400-e29b-41d4-a716-446655440000
```

**Webhook-Generated Keys:**
```
Format: webhook_{webhook_id}
Example: webhook_pay_789_evt_12345
```

### Idempotency Flow

```
┌─────────────────┐
│ 1. Receive      │
│    Request      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ 2. Extract Idempotency Key  │
│    - Check header           │
│    - Generate hash of body  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 3. Query Idempotency Table  │
│    WHERE key = ?            │
└────────┬────────────────────┘
         │
         ├─────► Key Exists
         │       ├──► Body Hash Matches
         │       │    └──► Return Cached Response (200)
         │       │
         │       └──► Body Hash Different
         │            └──► Return Error (409 Conflict)
         │
         └─────► Key Not Found
                 └──► Continue Processing
```

### Idempotency Implementation Details

**1. Middleware:**
```typescript
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const idempotencyKey = req.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        return res.status(400).json({
          error: 'Idempotency-Key header required'
        });
      }
      return next();
    }
    
    // Check for existing request
    const existing = await this.checkIdempotency(idempotencyKey, req.body);
    
    if (existing) {
      return res.status(existing.statusCode)
        .json(existing.response);
    }
    
    // Store for future requests
    req.idempotencyKey = idempotencyKey;
    next();
  }
}
```

**2. Response Storage:**
```typescript
async storeIdempotentResponse(
  key: string,
  method: string,
  path: string,
  bodyHash: string,
  statusCode: number,
  response: any
) {
  await prisma.idempotencyKey.create({
    data: {
      idempotencyKey: key,
      requestMethod: method,
      requestPath: path,
      requestBodyHash: bodyHash,
      responseStatus: statusCode,
      responseBody: response,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }
  });
}
```

**3. Cleanup Job:**
```typescript
// Run daily at 2 AM
@Cron('0 2 * * *')
async cleanupExpiredIdempotencyKeys() {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
  
  this.logger.log(`Cleaned up ${result.count} expired idempotency keys`);
}
```

---

## Transaction Management

### Transaction Boundaries

#### Subscription Service Transactions

**1. Create Subscription (with Payment Initiation)**

```typescript
async createSubscription(userId: string, planId: string) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Validate user and plan
    const user = await tx.user.findUnique({ where: { id: userId } });
    const plan = await tx.plan.findUnique({ where: { id: planId } });
    
    if (!user || !plan) {
      throw new NotFoundException('User or plan not found');
    }
    
    // 2. Check for existing active subscription
    const existing = await tx.subscription.findFirst({
      where: { userId, status: 'ACTIVE' }
    });
    
    if (existing) {
      throw new ConflictException('User already has active subscription');
    }
    
    // 3. Create subscription record (PENDING)
    const subscription = await tx.subscription.create({
      data: {
        userId,
        planId,
        status: 'PENDING',
        startDate: new Date()
      }
    });
    
    // 4. Create payment record (PENDING)
    const paymentRecord = await tx.paymentRecord.create({
      data: {
        subscriptionId: subscription.id,
        amount: plan.price,
        currency: 'USD',
        status: 'PENDING'
      }
    });
    
    return { subscription, paymentRecord };
  }, {
    isolationLevel: 'ReadCommitted',
    timeout: 10000 // 10 seconds
  });
  
  // 5. Call Payment Service (outside transaction)
  // This is idempotent, so safe to retry
}
```

**2. Process Payment Webhook**

```typescript
async processPaymentWebhook(webhookData: PaymentWebhookDto) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Find subscription by payment gateway ID
    const subscription = await tx.subscription.findFirst({
      where: { paymentGatewayId: webhookData.paymentId },
      include: { paymentRecords: true }
    });
    
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    
    // 2. Update subscription status
    const newStatus = webhookData.status === 'success' 
      ? 'ACTIVE' 
      : 'CANCELLED';
    
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      }
    });
    
    // 3. Update payment record
    await tx.paymentRecord.update({
      where: { id: subscription.paymentRecords[0].id },
      data: {
        status: webhookData.status === 'success' ? 'SUCCESS' : 'FAILED',
        paymentGatewayId: webhookData.paymentId,
        updatedAt: new Date()
      }
    });
    
    return subscription;
  }, {
    isolationLevel: 'Serializable', // Prevent concurrent webhook processing
    timeout: 5000
  });
}
```

**3. Upgrade Subscription**

```typescript
async upgradeSubscription(subscriptionId: string, newPlanId: string) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Lock subscription row
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });
    
    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Invalid subscription');
    }
    
    // 2. Validate new plan
    const newPlan = await tx.plan.findUnique({
      where: { id: newPlanId }
    });
    
    if (!newPlan || newPlan.price <= subscription.plan.price) {
      throw new BadRequestException('Invalid upgrade plan');
    }
    
    // 3. Update subscription
    const updated = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        previousPlanId: subscription.planId,
        planId: newPlanId,
        updatedAt: new Date()
      }
    });
    
    // 4. Create new payment record for prorated amount
    const proratedAmount = this.calculateProration(subscription, newPlan);
    
    await tx.paymentRecord.create({
      data: {
        subscriptionId: subscription.id,
        amount: proratedAmount,
        currency: 'USD',
        status: 'PENDING'
      }
    });
    
    return updated;
  }, {
    isolationLevel: 'RepeatableRead'
  });
}
```

#### Payment Service Transactions

**1. Initiate Payment**

```typescript
async initiatePayment(paymentDto: InitiatePaymentDto) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Create payment transaction
    const payment = await tx.paymentTransaction.create({
      data: {
        externalReference: paymentDto.externalReference,
        amount: paymentDto.amount,
        currency: paymentDto.currency,
        status: 'PENDING',
        metadata: paymentDto.metadata
      }
    });
    
    // 2. Simulate payment processing
    const success = this.simulatePayment();
    
    // 3. Update payment status
    const finalStatus = success ? 'SUCCESS' : 'FAILED';
    
    const updated = await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: { 
        status: finalStatus,
        updatedAt: new Date()
      }
    });
    
    return updated;
  }, {
    isolationLevel: 'ReadCommitted'
  });
  
  // 4. Send webhook (outside transaction, idempotent)
}
```

### Transaction Isolation Levels

| Operation | Isolation Level | Reason |
|-----------|----------------|--------|
| Create Subscription | READ COMMITTED | Standard isolation, prevents dirty reads |
| Process Webhook | SERIALIZABLE | Prevents concurrent webhook processing |
| Upgrade Subscription | REPEATABLE READ | Ensures consistent reads within transaction |
| Initiate Payment | READ COMMITTED | Standard isolation sufficient |

### Rollback Scenarios

**Scenario 1: Payment Service Unavailable During Subscription**
```
BEGIN TRANSACTION
  ✓ Create Subscription (PENDING)
  ✓ Create Payment Record (PENDING)
COMMIT

✗ Call Payment Service → Timeout/Error
  → Subscription remains in PENDING state
  → Background job retries payment initiation
  → If retry fails after N attempts, cancel subscription
```

**Scenario 2: Concurrent Webhook Processing**
```
BEGIN TRANSACTION (Serializable)
  ✓ Lock Subscription Row
  ✗ Status already updated (concurrent webhook)
ROLLBACK → Serialization Failure

Retry:
BEGIN TRANSACTION (Serializable)
  ✓ Lock Subscription Row
  ✓ Check if already processed (idempotency)
  → Return cached response
COMMIT
```

---

## Authentication and Authorization

### JWT-Based Authentication

**Authentication Flow:**

```
1. User Login
   POST /v1/auth/login
   { email, password }
   
2. Generate JWT Token
   - Include user ID
   - Include roles/permissions
   - Set expiration (1 hour)
   - Sign with secret key
   
3. Return Token
   { 
     accessToken: "eyJhbGc...",
     refreshToken: "refresh_...",
     expiresIn: 3600
   }
   
4. Client Includes Token in Requests
   Authorization: Bearer eyJhbGc...
   
5. Server Validates Token
   - Verify signature
   - Check expiration
   - Extract user context
```

**JWT Payload Structure:**
```json
{
  "sub": "user_123",
  "email": "john@example.com",
  "roles": ["user"],
  "iat": 1698765432,
  "exp": 1698769032
}
```

### Service-to-Service Authentication

**API Key Authentication:**
```
Authorization: Bearer service_key_abc123def456
```

**Configuration:**
```typescript
// In environment variables
PAYMENT_SERVICE_API_KEY=service_key_payment_xyz789
SUBSCRIPTION_SERVICE_API_KEY=service_key_subscription_abc123

// In service
@UseGuards(ApiKeyGuard)
@Post('/v1/payments/initiate')
async initiatePayment() {
  // Only accessible with valid API key
}
```

### Role-Based Access Control (RBAC)

**Roles:**
- `user`: Regular user (manage own subscriptions)
- `admin`: Administrator (manage all subscriptions, plans)
- `service`: Service account (inter-service communication)

**Permission Matrix:**

| Endpoint | User | Admin | Service |
|----------|------|-------|---------|
| GET /v1/users/me | ✓ | ✓ | - |
| GET /v1/users | - | ✓ | - |
| POST /v1/subscriptions | ✓ | ✓ | - |
| GET /v1/subscriptions | Own only | ✓ | - |
| POST /v1/webhooks/payment | - | - | ✓ |
| POST /v1/payments/initiate | - | - | ✓ |

---

## Error Handling Strategy

### Error Response Format

**Standard Error Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_EMAIL"
    },
    {
      "field": "planId",
      "message": "Plan does not exist",
      "code": "PLAN_NOT_FOUND"
    }
  ],
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/subscriptions",
  "requestId": "req_abc123"
}
```

### HTTP Status Codes

| Status Code | Usage |
|-------------|-------|
| 200 OK | Successful GET, PATCH, DELETE |
| 201 Created | Successful POST |
| 400 Bad Request | Validation errors, invalid input |
| 401 Unauthorized | Missing or invalid authentication |
| 403 Forbidden | Authenticated but no permission |
| 404 Not Found | Resource not found |
| 409 Conflict | Idempotency conflict, duplicate resource |
| 422 Unprocessable Entity | Business logic validation failed |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected server error |
| 502 Bad Gateway | Upstream service error |
| 503 Service Unavailable | Service temporarily unavailable |

### Error Categories

**1. Validation Errors (400)**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0",
      "code": "MIN_VALUE",
      "constraints": { "min": 0.01 }
    }
  ]
}
```

**2. Authentication Errors (401)**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized",
  "code": "TOKEN_EXPIRED"
}
```

**3. Business Logic Errors (422)**
```json
{
  "statusCode": 422,
  "message": "Cannot upgrade: subscription is not active",
  "error": "Unprocessable Entity",
  "code": "INVALID_SUBSCRIPTION_STATE",
  "details": {
    "currentStatus": "PENDING",
    "requiredStatus": "ACTIVE"
  }
}
```

**4. Service Errors (500)**
```json
{
  "statusCode": 500,
  "message": "An unexpected error occurred",
  "error": "Internal Server Error",
  "requestId": "req_abc123",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

### Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception.getStatus?.() || 500;
    const message = exception.message || 'Internal server error';
    
    // Log error
    this.logger.error({
      requestId: request.id,
      method: request.method,
      url: request.url,
      status,
      error: exception,
      stack: exception.stack
    });
    
    // Send error response
    response.status(status).json({
      statusCode: status,
      message,
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id
    });
  }
}
```

---

## Logging Strategy

### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| ERROR | Errors requiring immediate attention | Transaction failures, external service errors |
| WARN | Warning conditions | Deprecated API usage, high response times |
| INFO | General informational messages | Service startup, successful operations |
| DEBUG | Detailed debugging information | SQL queries, cache hits/misses |
| VERBOSE | Very detailed tracing | Request/response payloads |

### Structured Logging Format

```json
{
  "timestamp": "2025-10-29T12:00:00.000Z",
  "level": "INFO",
  "service": "subscription-service",
  "environment": "production",
  "requestId": "req_abc123",
  "userId": "user_123",
  "message": "Subscription created successfully",
  "context": {
    "subscriptionId": "sub_456",
    "planId": "plan_789",
    "amount": 29.99
  },
  "duration": 145,
  "statusCode": 201
}
```

### What to Log

**1. Request/Response:**
```typescript
{
  "type": "http_request",
  "method": "POST",
  "path": "/v1/subscriptions",
  "headers": { /* sanitized headers */ },
  "body": { /* sanitized body */ },
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**2. Database Operations:**
```typescript
{
  "type": "database_query",
  "operation": "INSERT",
  "table": "subscriptions",
  "duration": 25,
  "rowsAffected": 1
}
```

**3. External API Calls:**
```typescript
{
  "type": "external_api_call",
  "service": "payment-service",
  "endpoint": "/v1/payments/initiate",
  "method": "POST",
  "duration": 250,
  "statusCode": 201,
  "retries": 0
}
```

**4. Business Events:**
```typescript
{
  "type": "business_event",
  "event": "subscription_created",
  "userId": "user_123",
  "subscriptionId": "sub_456",
  "planId": "plan_789",
  "amount": 29.99
}
```

### Log Sanitization

**Sensitive Data to Redact:**
- Passwords
- API keys
- JWT tokens
- Credit card numbers
- Personal identifiable information (PII)

```typescript
function sanitizeLog(data: any): any {
  const sensitiveFields = ['password', 'token', 'apiKey', 'creditCard'];
  
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

---

## Monitoring and Observability

### Health Check Endpoints

**Subscription Service:**
```
GET /health
Response: { status: "ok", timestamp: "...", uptime: 3600 }

GET /health/db
Response: { status: "ok", latency: 5, connected: true }

GET /health/ready
Response: { status: "ok", dependencies: { database: "ok", cache: "ok" } }
```

### Metrics to Track

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections

**Business Metrics:**
- Subscriptions created (count)
- Subscription upgrades/downgrades (count)
- Payment success rate (%)
- Webhook delivery success rate (%)

**Infrastructure Metrics:**
- CPU usage (%)
- Memory usage (%)
- Database connections (count)
- Database query time (ms)

---

## Security Considerations

### 1. Input Validation
- Validate all input data using DTOs
- Sanitize input to prevent SQL injection
- Limit request payload size

### 2. Rate Limiting
```typescript
// Rate limit: 100 requests per minute per IP
@Throttle(100, 60)
@Controller('v1/subscriptions')
```

### 3. CORS Configuration
```typescript
app.enableCors({
  origin: ['https://app.example.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
});
```

### 4. Webhook Signature Verification
```typescript
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 5. SQL Injection Prevention
- Use Prisma ORM (parameterized queries)
- Never concatenate user input in queries
- Validate and sanitize all input

### 6. Secrets Management
- Store secrets in environment variables
- Use Docker secrets in production
- Rotate secrets regularly
- Never commit secrets to version control

---

## Deployment Architecture

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  subscription-service:
    build: ./apps/subscription-service
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/subscriptions
      
  payment-service:
    build: ./apps/payment-service
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/payments

volumes:
  postgres_data:
```

### Production Deployment (Kubernetes)

```
┌─────────────────────────────────────────────────────────────────┐
│                       Load Balancer (Ingress)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐           ┌──────────────────┐
│ Subscription Pod │           │  Payment Pod     │
│ (3 replicas)     │           │  (3 replicas)    │
└────────┬─────────┘           └────────┬─────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  PostgreSQL      │
              │  (Primary + Rep) │
              └──────────────────┘
```

---

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- Point-in-time recovery enabled
- Backup retention: 30 days
- Test restore process monthly

### Failover Plan
1. Detect service failure (health checks)
2. Redirect traffic to healthy instances
3. Investigate and resolve root cause
4. Scale up replacement instances
5. Monitor for cascading failures

---

## Conclusion

This architecture provides:
- ✅ Microservices independence
- ✅ Scalability and resilience
- ✅ Idempotency and consistency
- ✅ Comprehensive error handling
- ✅ Production-ready monitoring
- ✅ Security best practices

