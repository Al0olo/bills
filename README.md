# Bills - A Subscription Billing System

A microservices-based subscription billing system built with NestJS, Prisma, and PostgreSQL.

## Project Overview

This project implements a subscription billing system with two decoupled microservices:

1. **Subscription Service** - Manages users, plans, and subscriptions
2. **Payment Gateway Service** - Simulates payment processing and webhook delivery

### Key Features

**Microservices Architecture** - Independent services with separate databases  
**API Versioning** - URL-based versioning for backward compatibility  
**Idempotency** - Prevents duplicate operations in payment flows  
**Transaction Management** - ACID compliance with Prisma  
**Webhook System** - Reliable delivery with exponential backoff retry  
**JWT Authentication** - Secure user and service authentication  
**Comprehensive Testing** - Unit and integration tests  
**Docker Compose** - One-command local setup  
**Swagger Documentation** - Interactive API documentation  

---

## Documentation

Comprehensive design documentation is available in the [`docs/`](./docs) directory:

### Design Documents

**[Documentation Index](./docs/README.md)** - Overview of all documentation

**[Database Design](./docs/database-design.md)** - Complete schema, ERDs, and transaction boundaries

**[System Architecture](./docs/system-architecture.md)** - Architecture diagrams, communication patterns, and security

**[API Design](./docs/api-design.md)** - Complete API specifications with examples and sequence diagrams

---

## Architecture

```
┌──────────────────┐          ┌──────────────────┐
│  Subscription    │◄────────►│    Payment       │
│  Service         │ Webhooks │    Gateway       │
│  (Port 3000)     │          │    Service       │
│                  │          │    (Port 3001)   │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│   PostgreSQL     │          │   PostgreSQL     │
│subscriptions_db  │          │  payments_db     │
└──────────────────┘          └──────────────────┘
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Monorepo** | Nx + pnpm |
| **Framework** | NestJS (Node.js) |
| **ORM** | Prisma |
| **Database** | PostgreSQL 15 |
| **Authentication** | JWT |
| **Testing** | Jest + Supertest |
| **API Docs** | Swagger/OpenAPI |
| **Containerization** | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- Node.js 20+ 
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 15+ (for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/al0olo/bills.git
cd bills

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Generate Prisma clients
pnpm prisma:generate

# Start all services with Docker
pnpm docker:up
```

### Local Development (Without Docker)

```bash
# Start PostgreSQL locally
docker run -d --name bills-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:15-alpine

# Create databases
psql -U postgres -h localhost -c "CREATE DATABASE subscriptions;"
psql -U postgres -h localhost -c "CREATE DATABASE payments;"

# Run migrations
pnpm prisma:migrate:subscription
pnpm prisma:migrate:payment

# Start services
pnpm start:all
```

### Accessing the Services

- **Subscription Service**: http://localhost:3000
- **Subscription Service Swagger**: http://localhost:3000/api
- **Payment Service**: http://localhost:3001
- **Payment Service Swagger**: http://localhost:3001/api

---

## Project Structure

```
bills/
├── apps/
│   ├── subscription-service/     # User & Subscription Management
│   │   ├── src/
│   │   │   ├── users/
│   │   │   ├── plans/
│   │   │   ├── subscriptions/
│   │   │   ├── webhooks/
│   │   │   └── auth/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── payment-service/          # Payment Gateway Simulator
│       ├── src/
│       │   ├── payments/
│       │   └── webhooks/
│       └── prisma/
│           └── schema.prisma
├── libs/
│   ├── shared-types/             # Common TypeScript types
│   ├── shared-schemas/           # Shared DTOs
│   ├── common-utils/             # Utility functions
│   └── testing/                  # Shared test utilities
├── docs/                         # Documentation
│   ├── README.md
│   ├── database-design.md
│   └── system-architecture.md
├── docker/
│   ├── subscription.Dockerfile
│   └── payment.Dockerfile
├── docker-compose.yml
├── nx.json
├── pnpm-workspace.yaml
└── task.md
```

---

## API Overview

### Subscription Service (Port 3000)

#### Authentication
```http
POST /v1/auth/login
POST /v1/auth/register
```

#### Users
```http
GET    /v1/users
POST   /v1/users
GET    /v1/users/:id
PATCH  /v1/users/:id
```

#### Plans
```http
GET    /v1/plans
POST   /v1/plans
GET    /v1/plans/:id
PATCH  /v1/plans/:id
```

#### Subscriptions
```http
GET    /v1/subscriptions
POST   /v1/subscriptions
GET    /v1/subscriptions/:id
PATCH  /v1/subscriptions/:id/upgrade
PATCH  /v1/subscriptions/:id/downgrade
DELETE /v1/subscriptions/:id
```

#### Webhooks
```http
POST   /v1/webhooks/payment
```

### Payment Service (Port 3001)

```http
POST   /v1/payments/initiate
GET    /v1/payments/:id
POST   /v1/payments/:id/simulate
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run e2e tests
pnpm test:e2e

# Run tests for specific service
pnpm test subscription-service
pnpm test payment-service
```

---

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **API Key Auth** - Service-to-service authentication
- **Idempotency Keys** - Prevent duplicate operations
- **Input Validation** - DTO validation with class-validator
- **Rate Limiting** - Throttle decorator (100 req/min)
- **SQL Injection Prevention** - Prisma parameterized queries
- **Webhook Signatures** - HMAC-SHA256 verification
- **CORS** - Configured for specific origins

---

## Docker Deployment

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up -d --build
```

### Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

---

## Database Management

```bash
# Create a new migration
pnpm prisma:migrate:dev --name migration_name

# Apply migrations in production
pnpm prisma:migrate:deploy

# Generate Prisma Client
pnpm prisma:generate

# Open Prisma Studio (Database GUI)
pnpm prisma:studio

# Seed the database
pnpm seed
```

---

## Workflows

### Create Subscription Flow

1. User registers/logs in (JWT token obtained)
2. User selects a plan
3. POST `/v1/subscriptions` with `planId` and `Idempotency-Key`
4. Subscription Service creates subscription (PENDING)
5. Subscription Service calls Payment Service
6. Payment Service simulates payment (90% success rate)
7. Payment Service sends webhook to Subscription Service
8. Subscription Service updates subscription status (ACTIVE/CANCELLED)
9. User receives confirmation

### Webhook Retry Logic

- **Attempt 1**: Immediate
- **Attempt 2**: 30 seconds delay
- **Attempt 3**: 2 minutes delay
- **Attempt 4**: 10 minutes delay
- **Attempt 5**: 30 minutes delay
- **Attempt 6**: 1 hour delay

After 6 failed attempts, webhook is marked as FAILED and admin is notified.

---

## Monitoring

### Health Checks

```bash
# Subscription Service health
curl http://localhost:3000/health

# Payment Service health
curl http://localhost:3001/health

# Database connectivity
curl http://localhost:3000/health/db
```

### Metrics

The system tracks:
- Request rate and response times
- Error rates
- Payment success/failure rates
- Webhook delivery success rates
- Database query performance

---

## 🛠️ Development

### Adding a New Feature

1. Create feature branch
2. Implement changes in appropriate service
3. Add/update tests
4. Update Swagger documentation
5. Update relevant documentation
6. Submit PR for review

### Code Style

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

---

## Environment Variables

### Subscription Service

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/subscriptions

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1h

# Payment Service
PAYMENT_SERVICE_URL=http://payment-service:3001
PAYMENT_SERVICE_API_KEY=service_key_payment

# Webhook
WEBHOOK_SECRET=your-webhook-secret
```

### Payment Service

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payments

# Subscription Service
SUBSCRIPTION_SERVICE_URL=http://subscription-service:3000
SUBSCRIPTION_WEBHOOK_URL=http://subscription-service:3000/v1/webhooks/payment

# Payment Simulation
PAYMENT_SUCCESS_RATE=0.9
```
---

**Last Updated**: 2025-10-29  
**Version**: 1.0.0
