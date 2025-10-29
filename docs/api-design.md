# API Design Documentation

## Overview

This document provides complete API specifications for both microservices in the subscription billing system. All endpoints follow REST principles with versioned URLs, idempotency support, and comprehensive error handling.

---

## Global API Conventions

### Base URLs

- **Subscription Service**: `http://localhost:3000`
- **Payment Service**: `http://localhost:3001`

### Versioning

All endpoints use URL-based versioning:
```
/v1/resource
/v2/resource
```

### Common Headers

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer {jwt_token}
Idempotency-Key: {unique_key}  # Required for POST, PATCH, DELETE
X-Request-ID: {uuid}            # Optional, for tracing
```

#### Response Headers

```http
Content-Type: application/json
X-Request-ID: {uuid}
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765432
```

### HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE (no body) |
| 400 | Bad Request | Validation errors, malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Valid auth, insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Idempotency key conflict, duplicate resource |
| 422 | Unprocessable Entity | Business logic validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service failure |
| 503 | Service Unavailable | Service temporarily down |

### Error Response Format

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_FORMAT",
      "value": "invalid-email"
    }
  ],
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/users",
  "requestId": "req_abc123xyz"
}
```

### Pagination

For list endpoints, use query parameters:

```http
GET /v1/resource?page=1&limit=20&sort=createdAt&order=desc
```

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Subscription Service API

Base URL: `http://localhost:3000`

---

### Authentication Endpoints

#### 1. Register User

Create a new user account.

**Endpoint**: `POST /v1/auth/register`

**Authentication**: None

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Request Schema**:
```typescript
{
  email: string;      // Valid email, unique
  password: string;   // Min 8 chars, 1 uppercase, 1 number, 1 special
  name: string;       // 2-100 characters
}
```

**Success Response (201)**:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "createdAt": "2025-10-29T12:00:00.000Z",
    "updatedAt": "2025-10-29T12:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_abc123def456",
  "expiresIn": 3600
}
```

**Error Responses**:

**400 - Validation Error**:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least 1 uppercase letter",
      "code": "PASSWORD_WEAK"
    }
  ],
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/auth/register"
}
```

**409 - User Already Exists**:
```json
{
  "statusCode": 409,
  "message": "User with this email already exists",
  "error": "Conflict",
  "code": "USER_EXISTS",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/auth/register"
}
```

---

#### 2. Login

Authenticate and receive JWT tokens.

**Endpoint**: `POST /v1/auth/login`

**Authentication**: None

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200)**:
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john.doe@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_abc123def456",
  "expiresIn": 3600
}
```

**Error Responses**:

**401 - Invalid Credentials**:
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "code": "INVALID_CREDENTIALS",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/auth/login"
}
```

---

#### 3. Refresh Token

Get new access token using refresh token.

**Endpoint**: `POST /v1/auth/refresh`

**Authentication**: None

**Request Body**:
```json
{
  "refreshToken": "refresh_abc123def456"
}
```

**Success Response (200)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

### User Endpoints

#### 4. Get Current User

Get authenticated user's profile.

**Endpoint**: `GET /v1/users/me`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
```

**Success Response (200)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:00:00.000Z"
}
```

---

#### 5. Update Current User

Update authenticated user's profile.

**Endpoint**: `PATCH /v1/users/me`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: user_update_1698765432_abc123
```

**Request Body**:
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

**Success Response (200)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "john.smith@example.com",
  "name": "John Smith",
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:05:00.000Z"
}
```

---

#### 6. List Users (Admin Only)

Get paginated list of all users.

**Endpoint**: `GET /v1/users`

**Authentication**: Required (JWT, Admin role)

**Query Parameters**:
```
page=1          # Page number (default: 1)
limit=20        # Items per page (default: 20, max: 100)
sort=createdAt  # Sort field (default: createdAt)
order=desc      # Sort order: asc|desc (default: desc)
search=john     # Search in name or email
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "createdAt": "2025-10-29T12:00:00.000Z",
      "updatedAt": "2025-10-29T12:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "email": "jane.smith@example.com",
      "name": "Jane Smith",
      "createdAt": "2025-10-29T11:00:00.000Z",
      "updatedAt": "2025-10-29T11:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### Plan Endpoints

#### 7. List Plans

Get all available subscription plans.

**Endpoint**: `GET /v1/plans`

**Authentication**: Optional

**Query Parameters**:
```
isActive=true     # Filter by active status
billingCycle=MONTHLY  # Filter by billing cycle: MONTHLY|YEARLY
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "name": "Basic",
      "description": "Perfect for individuals",
      "price": 9.99,
      "billingCycle": "MONTHLY",
      "features": [
        "1 User",
        "10GB Storage",
        "Email Support"
      ],
      "isActive": true,
      "createdAt": "2025-10-29T10:00:00.000Z",
      "updatedAt": "2025-10-29T10:00:00.000Z"
    },
    {
      "id": "650e8400-e29b-41d4-a716-446655440002",
      "name": "Pro",
      "description": "Great for small teams",
      "price": 29.99,
      "billingCycle": "MONTHLY",
      "features": [
        "5 Users",
        "100GB Storage",
        "Priority Support",
        "API Access"
      ],
      "isActive": true,
      "createdAt": "2025-10-29T10:00:00.000Z",
      "updatedAt": "2025-10-29T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5
  }
}
```

---

#### 8. Get Plan by ID

Get details of a specific plan.

**Endpoint**: `GET /v1/plans/:id`

**Authentication**: Optional

**Success Response (200)**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Basic",
  "description": "Perfect for individuals",
  "price": 9.99,
  "billingCycle": "MONTHLY",
  "features": [
    "1 User",
    "10GB Storage",
    "Email Support"
  ],
  "isActive": true,
  "createdAt": "2025-10-29T10:00:00.000Z",
  "updatedAt": "2025-10-29T10:00:00.000Z"
}
```

**Error Response (404)**:
```json
{
  "statusCode": 404,
  "message": "Plan not found",
  "error": "Not Found",
  "code": "PLAN_NOT_FOUND",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/plans/invalid-id"
}
```

---

#### 9. Create Plan (Admin Only)

Create a new subscription plan.

**Endpoint**: `POST /v1/plans`

**Authentication**: Required (JWT, Admin role)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: plan_create_1698765432_abc123
```

**Request Body**:
```json
{
  "name": "Enterprise",
  "description": "For large organizations",
  "price": 99.99,
  "billingCycle": "MONTHLY",
  "features": [
    "Unlimited Users",
    "1TB Storage",
    "24/7 Support",
    "API Access",
    "Custom Integrations"
  ],
  "isActive": true
}
```

**Success Response (201)**:
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440003",
  "name": "Enterprise",
  "description": "For large organizations",
  "price": 99.99,
  "billingCycle": "MONTHLY",
  "features": [
    "Unlimited Users",
    "1TB Storage",
    "24/7 Support",
    "API Access",
    "Custom Integrations"
  ],
  "isActive": true,
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:00:00.000Z"
}
```

---

### Subscription Endpoints

#### 10. Create Subscription

Subscribe to a plan.

**Endpoint**: `POST /v1/subscriptions`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: sub_create_1698765432_abc123
```

**Request Body**:
```json
{
  "planId": "650e8400-e29b-41d4-a716-446655440001"
}
```

**Success Response (201)**:
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "planId": "650e8400-e29b-41d4-a716-446655440001",
  "status": "PENDING",
  "startDate": "2025-10-29T12:00:00.000Z",
  "endDate": null,
  "paymentGatewayId": null,
  "previousPlanId": null,
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:00:00.000Z",
  "plan": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Basic",
    "price": 9.99,
    "billingCycle": "MONTHLY"
  }
}
```

**Error Responses**:

**409 - User Already Has Active Subscription**:
```json
{
  "statusCode": 409,
  "message": "User already has an active subscription",
  "error": "Conflict",
  "code": "ACTIVE_SUBSCRIPTION_EXISTS",
  "details": {
    "existingSubscriptionId": "750e8400-e29b-41d4-a716-446655440001",
    "currentPlan": "Basic"
  },
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/subscriptions"
}
```

**404 - Plan Not Found**:
```json
{
  "statusCode": 404,
  "message": "Plan not found",
  "error": "Not Found",
  "code": "PLAN_NOT_FOUND",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/subscriptions"
}
```

---

#### 11. Get User Subscriptions

Get all subscriptions for authenticated user.

**Endpoint**: `GET /v1/subscriptions`

**Authentication**: Required (JWT)

**Query Parameters**:
```
status=ACTIVE     # Filter by status: PENDING|ACTIVE|CANCELLED|EXPIRED
page=1
limit=20
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440001",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "planId": "650e8400-e29b-41d4-a716-446655440001",
      "status": "ACTIVE",
      "startDate": "2025-10-29T12:00:00.000Z",
      "endDate": null,
      "paymentGatewayId": "pay_abc123",
      "previousPlanId": null,
      "createdAt": "2025-10-29T12:00:00.000Z",
      "updatedAt": "2025-10-29T12:01:00.000Z",
      "plan": {
        "id": "650e8400-e29b-41d4-a716-446655440001",
        "name": "Basic",
        "price": 9.99,
        "billingCycle": "MONTHLY"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### 12. Get Subscription by ID

Get details of a specific subscription.

**Endpoint**: `GET /v1/subscriptions/:id`

**Authentication**: Required (JWT)

**Success Response (200)**:
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "planId": "650e8400-e29b-41d4-a716-446655440001",
  "status": "ACTIVE",
  "startDate": "2025-10-29T12:00:00.000Z",
  "endDate": null,
  "paymentGatewayId": "pay_abc123",
  "previousPlanId": null,
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:01:00.000Z",
  "plan": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Basic",
    "description": "Perfect for individuals",
    "price": 9.99,
    "billingCycle": "MONTHLY",
    "features": ["1 User", "10GB Storage", "Email Support"]
  },
  "paymentRecords": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440001",
      "amount": 9.99,
      "currency": "USD",
      "status": "SUCCESS",
      "paymentGatewayId": "pay_abc123",
      "createdAt": "2025-10-29T12:00:00.000Z"
    }
  ]
}
```

---

#### 13. Upgrade Subscription

Upgrade to a higher-tier plan.

**Endpoint**: `PATCH /v1/subscriptions/:id/upgrade`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: sub_upgrade_1698765432_abc123
```

**Request Body**:
```json
{
  "newPlanId": "650e8400-e29b-41d4-a716-446655440002"
}
```

**Success Response (200)**:
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "planId": "650e8400-e29b-41d4-a716-446655440002",
  "status": "ACTIVE",
  "startDate": "2025-10-29T12:00:00.000Z",
  "endDate": null,
  "paymentGatewayId": "pay_def456",
  "previousPlanId": "650e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:05:00.000Z",
  "plan": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "name": "Pro",
    "price": 29.99,
    "billingCycle": "MONTHLY"
  },
  "previousPlan": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Basic",
    "price": 9.99,
    "billingCycle": "MONTHLY"
  },
  "proratedAmount": 20.00
}
```

**Error Responses**:

**422 - Cannot Upgrade to Same or Lower Plan**:
```json
{
  "statusCode": 422,
  "message": "New plan must be higher tier than current plan",
  "error": "Unprocessable Entity",
  "code": "INVALID_UPGRADE",
  "details": {
    "currentPlanPrice": 29.99,
    "newPlanPrice": 9.99
  },
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/subscriptions/750e8400-e29b-41d4-a716-446655440001/upgrade"
}
```

**422 - Subscription Not Active**:
```json
{
  "statusCode": 422,
  "message": "Cannot upgrade: subscription is not active",
  "error": "Unprocessable Entity",
  "code": "INVALID_SUBSCRIPTION_STATE",
  "details": {
    "currentStatus": "PENDING",
    "requiredStatus": "ACTIVE"
  },
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/subscriptions/750e8400-e29b-41d4-a716-446655440001/upgrade"
}
```

---

#### 14. Downgrade Subscription

Downgrade to a lower-tier plan.

**Endpoint**: `PATCH /v1/subscriptions/:id/downgrade`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: sub_downgrade_1698765432_abc123
```

**Request Body**:
```json
{
  "newPlanId": "650e8400-e29b-41d4-a716-446655440001"
}
```

**Success Response (200)**:
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "planId": "650e8400-e29b-41d4-a716-446655440001",
  "status": "ACTIVE",
  "startDate": "2025-10-29T12:00:00.000Z",
  "endDate": null,
  "paymentGatewayId": "pay_ghi789",
  "previousPlanId": "650e8400-e29b-41d4-a716-446655440002",
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:10:00.000Z",
  "plan": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Basic",
    "price": 9.99,
    "billingCycle": "MONTHLY"
  },
  "previousPlan": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "name": "Pro",
    "price": 29.99,
    "billingCycle": "MONTHLY"
  },
  "effectiveDate": "2025-11-29T12:00:00.000Z",
  "note": "Downgrade will take effect at the end of current billing period"
}
```

---

#### 15. Cancel Subscription

Cancel an active subscription.

**Endpoint**: `DELETE /v1/subscriptions/:id`

**Authentication**: Required (JWT)

**Headers**:
```http
Authorization: Bearer {jwt_token}
Idempotency-Key: sub_cancel_1698765432_abc123
```

**Request Body** (Optional):
```json
{
  "reason": "Too expensive",
  "feedback": "Great service, but I need to cut costs"
}
```

**Success Response (200)**:
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "planId": "650e8400-e29b-41d4-a716-446655440001",
  "status": "CANCELLED",
  "startDate": "2025-10-29T12:00:00.000Z",
  "endDate": "2025-10-29T12:15:00.000Z",
  "paymentGatewayId": "pay_abc123",
  "previousPlanId": null,
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:15:00.000Z",
  "message": "Subscription cancelled successfully"
}
```

---

### Webhook Endpoints

#### 16. Receive Payment Webhook

Receive payment status updates from Payment Service.

**Endpoint**: `POST /v1/webhooks/payment`

**Authentication**: Required (Service API Key)

**Headers**:
```http
Authorization: Bearer {service_api_key}
X-Webhook-Signature: {hmac_sha256_signature}
Idempotency-Key: webhook_pay_abc123_evt_001
```

**Request Body**:
```json
{
  "eventType": "payment.completed",
  "paymentId": "pay_abc123",
  "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001",
  "status": "success",
  "amount": 9.99,
  "currency": "USD",
  "timestamp": "2025-10-29T12:01:00.000Z",
  "metadata": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "planId": "650e8400-e29b-41d4-a716-446655440001"
  }
}
```

**Success Response (200)**:
```json
{
  "received": true,
  "processedAt": "2025-10-29T12:01:01.000Z",
  "subscriptionId": "750e8400-e29b-41d4-a716-446655440001",
  "newStatus": "ACTIVE"
}
```

**Error Responses**:

**401 - Invalid Signature**:
```json
{
  "statusCode": 401,
  "message": "Invalid webhook signature",
  "error": "Unauthorized",
  "code": "INVALID_SIGNATURE",
  "timestamp": "2025-10-29T12:01:00.000Z",
  "path": "/v1/webhooks/payment"
}
```

**404 - Subscription Not Found**:
```json
{
  "statusCode": 404,
  "message": "Subscription not found for payment reference",
  "error": "Not Found",
  "code": "SUBSCRIPTION_NOT_FOUND",
  "details": {
    "externalReference": "sub_invalid"
  },
  "timestamp": "2025-10-29T12:01:00.000Z",
  "path": "/v1/webhooks/payment"
}
```

---

## Payment Service API

Base URL: `http://localhost:3001`

---

### Payment Endpoints

#### 17. Initiate Payment

Create a payment transaction.

**Endpoint**: `POST /v1/payments/initiate`

**Authentication**: Required (Service API Key)

**Headers**:
```http
Authorization: Bearer {service_api_key}
Idempotency-Key: payment_init_1698765432_abc123
```

**Request Body**:
```json
{
  "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001",
  "amount": 9.99,
  "currency": "USD",
  "metadata": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "planId": "650e8400-e29b-41d4-a716-446655440001",
    "planName": "Basic"
  }
}
```

**Request Schema**:
```typescript
{
  externalReference: string;  // Unique reference from subscription service
  amount: number;             // Must be > 0
  currency: string;           // ISO 4217 code (e.g., USD, EUR)
  metadata?: object;          // Optional additional data
}
```

**Success Response (201)**:
```json
{
  "id": "pay_abc123",
  "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001",
  "amount": 9.99,
  "currency": "USD",
  "status": "PENDING",
  "webhookSent": false,
  "metadata": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "planId": "650e8400-e29b-41d4-a716-446655440001",
    "planName": "Basic"
  },
  "createdAt": "2025-10-29T12:00:30.000Z",
  "updatedAt": "2025-10-29T12:00:30.000Z"
}
```

**Error Responses**:

**400 - Invalid Amount**:
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
      "value": 0
    }
  ],
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/payments/initiate"
}
```

**409 - Duplicate External Reference**:
```json
{
  "statusCode": 409,
  "message": "Payment with this external reference already exists",
  "error": "Conflict",
  "code": "DUPLICATE_PAYMENT",
  "details": {
    "existingPaymentId": "pay_existing123",
    "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001"
  },
  "timestamp": "2025-10-29T12:00:00.000Z",
  "path": "/v1/payments/initiate"
}
```

---

#### 18. Get Payment Status

Retrieve payment transaction details.

**Endpoint**: `GET /v1/payments/:id`

**Authentication**: Required (Service API Key)

**Success Response (200)**:
```json
{
  "id": "pay_abc123",
  "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001",
  "amount": 9.99,
  "currency": "USD",
  "status": "SUCCESS",
  "webhookSent": true,
  "webhookRetryCount": 0,
  "webhookLastAttempt": "2025-10-29T12:01:00.000Z",
  "metadata": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "planId": "650e8400-e29b-41d4-a716-446655440001"
  },
  "createdAt": "2025-10-29T12:00:30.000Z",
  "updatedAt": "2025-10-29T12:01:00.000Z"
}
```

---

#### 19. Manually Simulate Payment (Development/Testing)

Force a payment to succeed or fail (for testing).

**Endpoint**: `POST /v1/payments/:id/simulate`

**Authentication**: Required (Service API Key)

**Note**: Only available in non-production environments

**Request Body**:
```json
{
  "status": "success"
}
```

**Request Schema**:
```typescript
{
  status: "success" | "failed";
}
```

**Success Response (200)**:
```json
{
  "id": "pay_abc123",
  "externalReference": "sub_750e8400-e29b-41d4-a716-446655440001",
  "amount": 9.99,
  "currency": "USD",
  "status": "SUCCESS",
  "webhookSent": true,
  "createdAt": "2025-10-29T12:00:30.000Z",
  "updatedAt": "2025-10-29T12:01:05.000Z",
  "message": "Payment manually simulated"
}
```

---

## Sequence Diagrams

### 1. Complete Subscription Flow with Payment

```
┌────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│ Client │     │ Subscription │     │   Payment   │     │  PostgreSQL │
│        │     │   Service    │     │   Service   │     │             │
└───┬────┘     └──────┬───────┘     └──────┬──────┘     └──────┬──────┘
    │                 │                     │                   │
    │ 1. POST /v1/subscriptions             │                   │
    │ {planId, idempotencyKey}              │                   │
    ├────────────────►│                     │                   │
    │                 │                     │                   │
    │                 │ 2. BEGIN TRANSACTION│                   │
    │                 ├─────────────────────┼──────────────────►│
    │                 │                     │                   │
    │                 │ 3. Validate user & plan                 │
    │                 │◄─────────────────────────────────────────┤
    │                 │                     │                   │
    │                 │ 4. Create subscription (PENDING)        │
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 5. Create payment_record (PENDING)      │
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 6. Store idempotency key                │
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 7. COMMIT           │                   │
    │                 │◄─────────────────────────────────────────┤
    │                 │                     │                   │
    │ 8. 201 Created  │                     │                   │
    │ {subscription: PENDING}               │                   │
    │◄────────────────┤                     │                   │
    │                 │                     │                   │
    │                 │ 9. POST /v1/payments/initiate           │
    │                 │ {externalRef, amount, idempotencyKey}   │
    │                 ├────────────────────►│                   │
    │                 │                     │                   │
    │                 │                     │ 10. Create payment│
    │                 │                     ├──────────────────►│
    │                 │                     │                   │
    │                 │                     │ 11. Simulate      │
    │                 │                     │     (90% success) │
    │                 │                     │                   │
    │                 │                     │ 12. Update status │
    │                 │                     │     (SUCCESS)     │
    │                 │                     ├──────────────────►│
    │                 │                     │                   │
    │                 │ 13. 201 Created     │                   │
    │                 │     {payment}       │                   │
    │                 │◄────────────────────┤                   │
    │                 │                     │                   │
    │                 │                     │ 14. Send Webhook  │
    │                 │                     │ POST /v1/webhooks/payment
    │                 │◄────────────────────┤                   │
    │                 │ {status: success}   │                   │
    │                 │                     │                   │
    │                 │ 15. BEGIN TRANSACTION                   │
    │                 ├─────────────────────┼──────────────────►│
    │                 │                     │                   │
    │                 │ 16. Find subscription by paymentGatewayId
    │                 │◄─────────────────────────────────────────┤
    │                 │                     │                   │
    │                 │ 17. Update subscription.status = ACTIVE │
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 18. Update payment_record.status = SUCCESS
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 19. Store webhook idempotency           │
    │                 ├────────────────────────────────────────►│
    │                 │                     │                   │
    │                 │ 20. COMMIT          │                   │
    │                 │◄─────────────────────────────────────────┤
    │                 │                     │                   │
    │                 │ 21. 200 OK          │                   │
    │                 │ {received: true}    │                   │
    │                 ├────────────────────►│                   │
    │                 │                     │                   │
    │ 22. GET /v1/subscriptions/:id         │                   │
    ├────────────────►│                     │                   │
    │                 │                     │                   │
    │ 23. 200 OK      │                     │                   │
    │ {subscription: ACTIVE}                │                   │
    │◄────────────────┤                     │                   │
    │                 │                     │                   │
```

---

### 2. Webhook Retry Flow

```
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   Payment   │          │ Subscription │          │  PostgreSQL │
│   Service   │          │   Service    │          │             │
└──────┬──────┘          └──────┬───────┘          └──────┬──────┘
       │                        │                         │
       │ 1. Send Webhook        │                         │
       │ POST /v1/webhooks/payment                        │
       ├───────────────────────►│                         │
       │                        │                         │
       │                        X (Connection Timeout)    │
       │◄───────────────────────┤                         │
       │ Timeout/Error          │                         │
       │                        │                         │
       │ 2. Update webhook status                         │
       │ webhookRetryCount++    │                         │
       ├──────────────────────────────────────────────────►│
       │                        │                         │
       │ 3. Wait 30s (Attempt 2)                          │
       │                        │                         │
       │ 4. Retry Webhook       │                         │
       ├───────────────────────►│                         │
       │                        │                         │
       │                        X (Service Unavailable)   │
       │◄───────────────────────┤                         │
       │ 503 Error              │                         │
       │                        │                         │
       │ 5. Update retry count  │                         │
       ├──────────────────────────────────────────────────►│
       │                        │                         │
       │ 6. Wait 2min (Attempt 3)                         │
       │                        │                         │
       │ 7. Retry Webhook       │                         │
       ├───────────────────────►│                         │
       │                        │                         │
       │                        │ 8. Process webhook      │
       │                        ├────────────────────────►│
       │                        │                         │
       │ 9. 200 OK              │                         │
       │ {received: true}       │                         │
       │◄───────────────────────┤                         │
       │                        │                         │
       │ 10. Update webhook status = DELIVERED            │
       ├──────────────────────────────────────────────────►│
       │                        │                         │
```

---

### 3. Idempotency Handling Flow

```
┌────────┐          ┌──────────────┐          ┌─────────────┐
│ Client │          │   Service    │          │  PostgreSQL │
└───┬────┘          └──────┬───────┘          └──────┬──────┘
    │                      │                         │
    │ 1. POST /v1/subscriptions                      │
    │ Idempotency-Key: key_123                       │
    │ Body: {planId: "plan_abc"}                     │
    ├─────────────────────►│                         │
    │                      │                         │
    │                      │ 2. Check idempotency    │
    │                      │ WHERE key = "key_123"   │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 3. Not Found            │
    │                      │◄────────────────────────┤
    │                      │                         │
    │                      │ 4. Process request      │
    │                      │ (Create subscription)   │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 5. Store idempotency    │
    │                      │ key + response          │
    │                      ├────────────────────────►│
    │                      │                         │
    │ 6. 201 Created       │                         │
    │ {subscription}       │                         │
    │◄─────────────────────┤                         │
    │                      │                         │
    │ 7. Retry (network failure)                     │
    │ POST /v1/subscriptions                         │
    │ Idempotency-Key: key_123                       │
    │ Body: {planId: "plan_abc"}                     │
    ├─────────────────────►│                         │
    │                      │                         │
    │                      │ 8. Check idempotency    │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 9. Found! (same body hash)
    │                      │◄────────────────────────┤
    │                      │                         │
    │ 10. 201 Created      │                         │
    │ {subscription}       │                         │
    │ (Cached response)    │                         │
    │◄─────────────────────┤                         │
    │                      │                         │
    │ 11. Retry with different body                  │
    │ POST /v1/subscriptions                         │
    │ Idempotency-Key: key_123                       │
    │ Body: {planId: "plan_xyz"}  ← Different        │
    ├─────────────────────►│                         │
    │                      │                         │
    │                      │ 12. Check idempotency   │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 13. Found! (different hash)
    │                      │◄────────────────────────┤
    │                      │                         │
    │ 14. 409 Conflict     │                         │
    │ {error: "Idempotency key used with different body"}
    │◄─────────────────────┤                         │
    │                      │                         │
```

---

### 4. Transaction Rollback Scenario

```
┌────────┐          ┌──────────────┐          ┌─────────────┐
│ Client │          │ Subscription │          │  PostgreSQL │
│        │          │   Service    │          │             │
└───┬────┘          └──────┬───────┘          └──────┬──────┘
    │                      │                         │
    │ 1. POST /v1/subscriptions/:id/upgrade          │
    ├─────────────────────►│                         │
    │                      │                         │
    │                      │ 2. BEGIN TRANSACTION    │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 3. SELECT subscription  │
    │                      │    FOR UPDATE           │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 4. Return subscription  │
    │                      │◄────────────────────────┤
    │                      │                         │
    │                      │ 5. Validate upgrade     │
    │                      │    (Business logic)     │
    │                      │                         │
    │                      │ 6. Update subscription  │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 7. Success              │
    │                      │◄────────────────────────┤
    │                      │                         │
    │                      │ 8. Create payment_record│
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 9. Foreign Key Error!   │
    │                      │    (planId invalid)     │
    │                      │◄────────────────────────┤
    │                      │                         │
    │                      │ 10. ROLLBACK            │
    │                      ├────────────────────────►│
    │                      │                         │
    │                      │ 11. All changes reverted│
    │                      │◄────────────────────────┤
    │                      │                         │
    │ 12. 400 Bad Request  │                         │
    │ {error: "Invalid plan"}                        │
    │◄─────────────────────┤                         │
    │                      │                         │
```

---

## Rate Limiting

### Rate Limit Configuration

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| Authentication | 5 requests | 1 minute |
| Subscription CRUD | 100 requests | 1 minute |
| Webhook | 1000 requests | 1 minute |
| Payment Initiation | 50 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765492
```

### Rate Limit Exceeded Response (429)

```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "limit": 100,
  "window": "1 minute",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

---

## Testing with cURL

### Example: Complete Subscription Flow

```bash
# 1. Register user
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'

# Response: Save the accessToken

# 2. Get available plans
curl -X GET http://localhost:3000/v1/plans

# Response: Choose a planId

# 3. Create subscription
curl -X POST http://localhost:3000/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Idempotency-Key: sub_$(date +%s)_$(uuidgen)" \
  -d '{
    "planId": "PLAN_ID_FROM_STEP_2"
  }'

# 4. Check subscription status
curl -X GET http://localhost:3000/v1/subscriptions/SUBSCRIPTION_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Postman Collection

A complete Postman collection is available at `/docs/postman_collection.json` with:
- All endpoints pre-configured
- Environment variables for tokens and IDs
- Example requests and responses
- Automated tests for status codes

---

## API Versioning Strategy

### Version Lifecycle

1. **v1 (Current)**: Initial release
2. **Deprecation Notice**: 6 months before sunset
3. **v2 Release**: New version with breaking changes
4. **v1 Sunset**: Remove v1 after 12 months

### Breaking vs Non-Breaking Changes

**Non-Breaking (Same Version)**:
- Adding new optional fields
- Adding new endpoints
- Adding new response fields

**Breaking (New Version)**:
- Removing fields
- Changing field types
- Changing endpoint URLs
- Changing authentication

### Deprecation Header

```http
X-API-Deprecation: This API version will be sunset on 2026-10-29
X-API-Sunset-Date: 2026-10-29T00:00:00Z
X-API-New-Version: /v2/subscriptions
```

---

## Conclusion

This API design provides:
- ✅ Complete endpoint specifications
- ✅ Detailed request/response schemas
- ✅ Comprehensive error handling
- ✅ Idempotency support
- ✅ Sequence diagrams for key workflows
- ✅ Rate limiting
- ✅ Versioning strategy
- ✅ Testing examples

All endpoints are production-ready with proper authentication, validation, and error handling.

---

**Last Updated**: 2025-10-29  
**API Version**: v1  
**Status**: Design Complete

