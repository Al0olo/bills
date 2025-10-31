# Documentation Index

This directory contains comprehensive documentation for the Subscription Billing System.

## Documents Overview

### 1. [Database Design](./database-design.md)
Complete database schema documentation including:
- Entity Relationship Diagrams (ERD)
- Table definitions with all columns, types, and constraints
- Indexes and performance optimizations
- Transaction boundaries and isolation levels
- Sample seed data
- Migration strategy

**Key Sections:**
- Subscription Service Database (users, plans, subscriptions, payment_records, idempotency_keys)
- Payment Service Database (payment_transactions, idempotency_keys)
- Transaction management examples
- Performance optimization strategies

---

### 2. [System Architecture](./system-architecture.md)
Comprehensive system architecture documentation including:
- High-level architecture diagrams
- Service communication patterns
- API versioning strategy
- Webhook flows and retry mechanisms
- Idempotency implementation
- Transaction management
- Authentication & authorization
- Error handling and logging
- Monitoring and observability
- Security considerations
- Deployment architecture

**Key Sections:**
- Service descriptions and responsibilities
- Synchronous and asynchronous communication patterns
- Exponential backoff retry logic
- JWT authentication flow
- Structured error responses
- Production deployment considerations

---

### 3. [API Design](./api-design.md)
Complete API specification for both microservices including:
- Detailed endpoint specifications with examples
- Request/response schemas
- Authentication headers and JWT flows
- Idempotency key usage
- Error response formats
- Sequence diagrams for key workflows
- Rate limiting configuration
- Pagination patterns
- cURL examples
- API versioning lifecycle

**Key Sections:**
- Subscription Service API (16 endpoints)
- Payment Service API (3 endpoints)
- Complete subscription flow sequence diagram
- Webhook retry flow diagram
- Idempotency handling diagram
- Transaction rollback scenarios
- Testing examples with cURL

---

### 4. [Testing Guide](./TESTING.md)
Comprehensive testing documentation including:
- Test infrastructure setup and configuration
- Unit, integration, and E2E testing strategies
- Running tests and interpreting coverage reports
- Writing effective tests with best practices
- Test utilities and helper functions
- Seed data and test fixtures
- Docker test environment setup
- Troubleshooting common issues
- CI/CD integration examples

**Key Sections:**
- Test Infrastructure (shared libraries, Jest config)
- Unit Tests (~800+ test cases, 95% coverage)
- Test Utilities (@bills/testing library)
- Database seeding and fixtures
- Docker Compose test environment
- Best practices and patterns
- Common troubleshooting scenarios

---

## Quick Reference

### Architecture at a Glance

```
Client → Subscription Service (Port 3000) → PostgreSQL (subscriptions_db)
              ↓           ↑
           Payment     Webhook
              ↓           ↑
         Payment Service (Port 3001) → PostgreSQL (payments_db)
```

### Key Design Decisions

1. **Microservices Architecture**: Two independent services with separate databases
2. **API Versioning**: URL-based versioning (`/v1/`, `/v2/`)
3. **Idempotency**: All mutation operations require idempotency keys
4. **Transactions**: ACID compliance using Prisma transactions
5. **Authentication**: JWT for users, API keys for service-to-service
6. **Webhooks**: Exponential backoff retry with up to 6 attempts
7. **Monorepo**: Nx workspace with pnpm for efficient development

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Monorepo | Nx + pnpm |
| Framework | NestJS |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | JWT |
| Testing | Jest + Supertest |
| Documentation | Swagger/OpenAPI |
| Containerization | Docker + Docker Compose |

---

## Database Schema Summary

### Subscription Service

**users** → **subscriptions** → **plans**
             ↓
      **payment_records**

**idempotency_keys** (standalone)

### Payment Service

**payment_transactions** (links to subscriptions via externalReference)

**idempotency_keys** (standalone)

---

## Key Workflows

### Subscription Creation Flow

1. Client creates subscription (POST /v1/subscriptions)
2. Subscription Service:
   - Validates user and plan
   - Creates subscription (PENDING)
   - Creates payment record (PENDING)
   - Calls Payment Service
3. Payment Service:
   - Creates payment transaction
   - Simulates payment (90% success rate)
   - Sends webhook to Subscription Service
4. Subscription Service:
   - Receives webhook
   - Updates subscription status (ACTIVE/CANCELLED)
   - Updates payment record

### Idempotency Flow

1. Client sends request with `Idempotency-Key` header
2. Service checks if key exists in database
3. If exists and body hash matches → return cached response
4. If exists and body hash differs → return 409 Conflict
5. If not exists → process request and cache response

### Webhook Retry Flow

1. Send webhook to target service
2. If success (2xx) → mark as DELIVERED
3. If failure → schedule retry with exponential backoff
4. Retry up to 6 times (max 1h 42.5min)
5. After 6 failures → mark as FAILED and alert admins

---

## Security Features

- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: DTO validation with class-validator
- **SQL Injection Prevention**: Prisma parameterized queries
- **Rate Limiting**: Throttle decorator (100 req/min)
- **Webhook Signatures**: HMAC-SHA256 verification
- **CORS**: Configured for specific origins
- **Secrets Management**: Environment variables + Docker secrets

---

## Monitoring & Observability

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity
- `GET /health/ready` - Readiness check (all dependencies)

### Key Metrics

**Application:**
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)

**Business:**
- Subscriptions created
- Payment success rate
- Webhook delivery rate

**Infrastructure:**
- CPU/Memory usage
- Database connections
- Query performance

---

## Document Conventions

### Diagrams
- ASCII diagrams for portability
- Flow direction: top to bottom, left to right
- Clear labeling of components

### Code Examples
- TypeScript for all examples
- Async/await patterns
- Error handling included
- Comments for clarity

### Naming Conventions
- camelCase for variables and functions
- PascalCase for classes and types
- UPPER_SNAKE_CASE for constants
- kebab-case for file names

---

**Last Updated**: 2025-10-30
**Version**: 1.2.0
**Status**: Unit Testing Complete (800+ tests, 95% coverage)

