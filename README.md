# Bills - Subscription & Payment Microservices Platform

> **Production-Ready** | **100% Test Coverage** | **Fully Automated CI/CD**

A microservices-based subscription billing system built with NestJS, Prisma, and PostgreSQL. Features comprehensive testing, automated CI/CD pipeline, and multi-platform Docker support.

[![Tests](https://img.shields.io/badge/tests-562%20passing-brightgreen)](RELEASE-NOTES.md)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](RELEASE-NOTES.md)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue)](.github/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/docker-multi--platform-blue)](docker/)

---

## 🎯 Project Overview

This project implements a production-ready subscription billing system with two decoupled microservices:

1. **Subscription Service** - User management, plans, subscriptions, and payment orchestration
2. **Payment Service** - Payment processing simulation and webhook notifications

### ✨ Key Features

- **🏗️ Microservices Architecture** - Independent services with separate databases and schemas
- **🚀 CI/CD Pipeline** - Automated testing, building, and deployment with GitHub Actions
- **🧪 Comprehensive Testing** - 562 tests with 100% pass rate (unit + integration + E2E)
- **🐳 Multi-Platform Docker** - Images for linux/amd64 and linux/arm64
- **🔐 Security First** - JWT authentication, API keys, HMAC signatures, idempotency
- **📚 Complete Documentation** - OpenAPI/Swagger, architecture diagrams, and guides
- **🔄 Event-Driven** - Webhook system with exponential backoff retry logic
- **💾 Transaction Management** - ACID compliance with Prisma ORM
- **📦 Monorepo** - Nx workspace with shared libraries and utilities
- **⚡ Performance** - Optimized builds, caching, and parallel execution

---

## 📊 Project Status

| Metric | Status |
|--------|--------|
| **Version** | v1.0.0 (Production Ready) |
| **Test Suites** | 31 passed ✅ |
| **Total Tests** | 562 passed (100%) ✅ |
| **Unit Tests** | 487 passed ✅ |
| **Integration Tests** | 74 passed ✅ |
| **E2E Tests** | 1 passed ✅ |
| **CI/CD** | Fully Automated ✅ |
| **Docker Images** | Multi-platform ✅ |
| **Documentation** | Complete ✅ |

---

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

| Document | Description |
|----------|-------------|
| **[System Architecture](./docs/system-architecture.md)** | Architecture diagrams, communication patterns, security |
| **[Database Design](./docs/database-design.md)** | Complete schema, ERDs, transaction boundaries |
| **[API Design](./docs/api-design.md)** | API specifications with examples and sequence diagrams |
| **[Testing Guide](./docs/TESTING.md)** | Testing strategies and best practices |
| **[CI/CD Guide](./docs/CI-CD.md)** | Complete CI/CD pipeline documentation |
| **[Release Notes](./RELEASE-NOTES.md)** | Detailed release information |
| **[Changelog](./CHANGELOG.md)** | Version history and changes |

### 🔍 API Documentation

- **Subscription Service Swagger:** http://localhost:3000/api
- **Payment Service Swagger:** http://localhost:3001/api

> **Note:** API endpoints are documented in OpenAPI/Swagger format. Access the interactive documentation when services are running.

---

## 🏗️ Architecture

```
┌──────────────────┐          ┌──────────────────┐
│  Subscription    │◄────────►│    Payment       │
│  Service         │ Webhooks │    Service       │
│  (Port 3000)     │          │    (Port 3001)   │
│                  │          │                  │
│  • Users         │          │  • Payments      │
│  • Plans         │          │  • Simulation    │
│  • Subscriptions │          │  • Webhooks      │
│  • Auth          │          │  • Idempotency   │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│   PostgreSQL     │          │   PostgreSQL     │
│ subscription-db  │          │   payment-db     │
│ (schema-based)   │          │ (schema-based)   │
└──────────────────┘          └──────────────────┘
```

### 🛠️ Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Monorepo** | Nx | 22.0.2 |
| **Package Manager** | pnpm | 10.12.4 |
| **Runtime** | Node.js | 20+ |
| **Framework** | NestJS | 11.1.8 |
| **ORM** | Prisma | 6.18.0 |
| **Database** | PostgreSQL | 15 |
| **Authentication** | JWT | passport-jwt |
| **Testing** | Jest | 30.2.0 |
| **API Docs** | Swagger/OpenAPI | 3.0 |
| **CI/CD** | GitHub Actions | Latest |
| **Containerization** | Docker | Latest |
| **Container Registry** | GitHub Container Registry (ghcr.io) | - |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 10.12.4+
- **Docker** & Docker Compose (for containerized setup)
- **PostgreSQL** 15+ (for local development without Docker)

### 🎬 Installation

```bash
# Clone the repository
git clone https://github.com/al0olo/bills.git
cd bills

# Install dependencies
pnpm install

# Generate Prisma clients
pnpm prisma:generate

# Set up environment variables (optional for unit tests)
cp .env.example .env
```

### 🐳 Docker Setup (Recommended)

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### 💻 Local Development (Without Docker)

```bash
# Start PostgreSQL
docker run -d --name bills-postgres \
  -e POSTGRES_USER=foodizone \
  -e POSTGRES_PASSWORD=foodizone_password \
  -e POSTGRES_DB=foodizone \
  -p 5432:5432 postgres:15-alpine

# Run database migrations
pnpm prisma:migrate:subscription
pnpm prisma:migrate:payment

# Seed the database (optional)
pnpm seed

# Start services in development mode
pnpm dev
```

### 🌐 Accessing Services

| Service | URL | Description |
|---------|-----|-------------|
| **Subscription Service** | http://localhost:3000 | Main API |
| **Subscription API Docs** | http://localhost:3000/api | Swagger UI |
| **Payment Service** | http://localhost:3001 | Payment API |
| **Payment API Docs** | http://localhost:3001/api | Swagger UI |

---

## 📦 Project Structure

```
bills/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Main CI/CD pipeline
│       └── ci-local.yml              # Local testing workflow
├── apps/
│   ├── subscription-service/         # Subscription microservice
│   │   ├── src/
│   │   │   ├── auth/                # Authentication & JWT
│   │   │   ├── users/               # User management
│   │   │   ├── plans/               # Subscription plans
│   │   │   ├── subscriptions/       # Subscription lifecycle
│   │   │   ├── webhooks/            # Webhook handlers
│   │   │   ├── payment-client/      # Payment service client
│   │   │   ├── prisma/              # Prisma service
│   │   │   └── common/              # Guards, interceptors, filters
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   ├── migrations/          # Database migrations
│   │   │   └── seed.ts              # Database seeding
│   │   └── test-utils/              # Test configuration
│   └── payment-service/              # Payment microservice
│       ├── src/
│       │   ├── payments/            # Payment processing
│       │   ├── webhook/             # Webhook delivery
│       │   ├── prisma/              # Prisma service
│       │   └── common/              # Guards, interceptors
│       ├── prisma/
│       │   ├── schema.prisma        # Database schema
│       │   └── migrations/          # Database migrations
│       └── test-utils/              # Test configuration
├── libs/
│   ├── testing/                     # Shared test utilities
│   │   ├── src/lib/
│   │   │   ├── test-auth.helper.ts  # Auth testing helpers
│   │   │   ├── test-fixtures.ts     # Test data factories
│   │   │   ├── test-db.helper.ts    # Database helpers
│   │   │   ├── mock-services.ts     # Service mocks
│   │   │   └── assertions.helper.ts # Custom matchers
│   │   └── types/                   # Type declarations
│   ├── shared-types/                # Common TypeScript types
│   ├── shared-schemas/              # Shared DTOs
│   └── common-utils/                # Utility functions
├── docs/                            # Documentation
│   ├── README.md                    # Documentation index
│   ├── system-architecture.md       # Architecture details
│   ├── database-design.md           # Database design
│   ├── api-design.md                # API specifications
│   ├── TESTING.md                   # Testing guide
│   └── CI-CD.md                     # CI/CD documentation
├── docker/
│   ├── subscription.Dockerfile      # Subscription service image
│   └── payment.Dockerfile           # Payment service image
├── scripts/
│   ├── validate-ci.sh               # CI validation script
│   └── test-ci-local.sh             # Local CI testing
├── docker-compose.yml               # Docker Compose configuration
├── docker-compose.test.yml          # Test environment setup
├── RELEASE-NOTES.md                 # Release documentation
├── CHANGELOG.md                     # Version history
├── nx.json                          # Nx workspace config
├── pnpm-workspace.yaml              # pnpm workspace config
└── package.json                     # Root package config
```

---

## 🧪 Testing

### Test Coverage

```
Subscription Service:
├── Unit Tests:        402/402 passing (100%) ✅
├── Integration Tests:  56/56  passing (100%) ✅
└── E2E Tests:           1/1   passing (100%) ✅

Payment Service:
├── Unit Tests:        85/85  passing (100%) ✅
└── Integration Tests: 18/18  passing (100%) ✅

Total: 562 tests passing (100%)
```

### Running Tests

```bash
# Run all unit tests (fast, no database needed)
pnpm test

# Run all tests for specific service
pnpm nx run subscription-service:test
pnpm nx run payment-service:test

# Run integration tests (requires PostgreSQL)
docker-compose -f docker-compose.test.yml up -d postgres-test
pnpm test:integration

# Run with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e

# Run all tests (unit + integration + E2E)
pnpm test:all
```

### Test Features

- ✅ **Zero external dependencies** for unit tests
- ✅ **Lazy-loaded bcrypt** for cross-platform compatibility
- ✅ **Shared test utilities** in `@bills/testing` library
- ✅ **Custom Jest matchers** for domain-specific assertions
- ✅ **Test fixtures and factories** for data generation
- ✅ **Database cleanup helpers** for integration tests
- ✅ **Parallel execution** for faster test runs

---

## 🔄 CI/CD Pipeline

### Pipeline Stages

The GitHub Actions workflow includes 3 main stages:

```
┌─────────────────┐
│  1. Unit Tests  │  Runs in parallel for both services
│  ~2-3 min each  │  No database required
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Integration  │  Runs in parallel with PostgreSQL
│  Tests          │  Real database connections
│  ~3-5 min each  │  Separate schemas per service
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Docker Build │  Builds and pushes images
│  & Push         │  Multi-platform support
│  ~3-4 min each  │  Published to ghcr.io
└─────────────────┘

Total Time: ~10-12 minutes
```

### Triggers

- **Push** to `main` or `develop` branches
- **Pull requests** to `main` or `develop`
- **Manual** workflow dispatch

### Docker Images

Images are automatically published to GitHub Container Registry:

```bash
# Pull latest images
docker pull ghcr.io/[owner]/bills-subscription-service:latest
docker pull ghcr.io/[owner]/bills-payment-service:latest

# Pull specific version
docker pull ghcr.io/[owner]/bills-subscription-service:v1.0.0
docker pull ghcr.io/[owner]/bills-payment-service:sha-abc123
```

### CI/CD Features

- ✅ **Automated testing** on every push
- ✅ **Parallel execution** for faster builds
- ✅ **Smart caching** (dependencies + Docker layers)
- ✅ **Multi-platform builds** (amd64 + arm64)
- ✅ **Automatic versioning** (branch, SHA, latest tags)
- ✅ **Code coverage** reporting (optional)

For detailed CI/CD documentation, see [docs/CI-CD.md](docs/CI-CD.md)

---

## 🔐 Security Features

- **JWT Authentication** - Secure token-based user authentication
- **API Key Authentication** - Service-to-service communication
- **Idempotency Keys** - Prevent duplicate payment operations
- **HMAC Webhook Signatures** - SHA-256 signature verification
- **Input Validation** - Comprehensive DTO validation with class-validator
- **Rate Limiting** - Throttle decorator (100 requests/minute)
- **SQL Injection Prevention** - Prisma parameterized queries
- **Transaction Isolation** - ACID compliance with proper boundaries
- **CORS Configuration** - Configured for specific origins
- **Environment Variables** - Sensitive data externalized
- **Password Hashing** - bcrypt with configurable rounds

---

## 🗄️ Database Management

```bash
# Create a new migration
pnpm prisma:migrate:dev --name migration_name

# Apply migrations to production
pnpm prisma:migrate:deploy

# Generate Prisma clients
pnpm prisma:generate

# Seed the database
pnpm seed

# Open Prisma Studio (Database GUI)
pnpm prisma:studio

# Push schema changes (for development)
pnpm prisma db push
```

### Database Architecture

- **Separate databases** per service for isolation
- **Schema-based separation** for testing (subscription-test, payments-test)
- **Prisma migrations** for version control
- **Transaction support** with Prisma's executeTransaction
- **Connection pooling** configured for production

---

## 🔄 Key Workflows

### Create Subscription Flow

1. User registers/logs in → JWT token issued
2. User browses available plans
3. User creates subscription with `planId` + `Idempotency-Key`
4. Subscription created in PENDING status
5. Payment initiation request sent to Payment Service
6. Payment Service processes payment (simulated 80% success rate)
7. Payment Service sends webhook to Subscription Service
8. Subscription status updated (ACTIVE or CANCELLED)
9. User notified of subscription status

### Webhook Retry Strategy

Exponential backoff with 6 attempts:

| Attempt | Delay | Total Elapsed |
|---------|-------|---------------|
| 1 | Immediate | 0s |
| 2 | 30 seconds | 30s |
| 3 | 2 minutes | 2m 30s |
| 4 | 10 minutes | 12m 30s |
| 5 | 30 minutes | 42m 30s |
| 6 | 1 hour | 1h 42m 30s |

After 6 failed attempts, webhook marked as FAILED and requires manual intervention.

---

## 🛠️ Development

### Code Quality

```bash
# Lint code
pnpm lint

# Format code with Prettier
pnpm format

# Type checking
pnpm type-check

# Run all quality checks
pnpm lint && pnpm type-check && pnpm test
```

### Local Testing with act (Optional)

Test GitHub Actions workflows locally:

```bash
# Install act (macOS)
brew install act

# Validate workflows
./scripts/validate-ci.sh

# Test workflows locally
./scripts/test-ci-local.sh quick
```

---

## 📈 Monitoring & Health Checks

```bash
# Health check endpoints
curl http://localhost:3000/health    # Subscription service
curl http://localhost:3001/health    # Payment service

# Database connectivity
curl http://localhost:3000/health/db
```

### Metrics Tracked

- Request rate and response times
- Error rates and types
- Payment success/failure rates
- Webhook delivery success rates
- Database query performance
- Test execution times

---

## 🌍 Environment Variables

### Subscription Service

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/foodizone?schema=subscriptions
JWT_SECRET=your-secret-key-minimum-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-key-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
PAYMENT_SERVICE_URL=http://payment-service:3001
PAYMENT_SERVICE_API_KEY=your-api-key
WEBHOOK_SECRET=your-webhook-secret-32-characters
```

### Payment Service

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/foodizone?schema=payments
API_KEY=your-api-key
SUBSCRIPTION_SERVICE_WEBHOOK_URL=http://subscription-service:3000/v1/webhooks/payment
WEBHOOK_SECRET=your-webhook-secret-32-characters
PAYMENT_SUCCESS_RATE=80
PAYMENT_PROCESSING_DELAY_MS=1000
```

> **Note:** For testing, environment variables have sensible defaults and `.env.test` is optional.

---

## 🤝 Contributing

### Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add/update tests
5. Update documentation
6. Run quality checks (`pnpm lint && pnpm test`)
7. Commit your changes (`git commit -m 'feat: add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Standards

- Follow NestJS best practices
- Write comprehensive tests (aim for 100% coverage)
- Update documentation for new features
- Use TypeScript strict mode
- Follow commit message conventions (conventional commits)

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎉 Acknowledgments

- **NestJS Team** - Excellent framework and documentation
- **Prisma Team** - Powerful ORM with great TypeScript support
- **GitHub** - CI/CD with Actions and Container Registry
- **Open Source Community** - Amazing tools and libraries

---

## 📞 Support

- **Documentation:** See `docs/` directory
- **Issues:** [Create an issue](https://github.com/al0olo/bills/issues)
- **CI/CD Help:** See [CI/CD Guide](docs/CI-CD.md)
- **Release Notes:** See [RELEASE-NOTES.md](RELEASE-NOTES.md)

---

## 🚀 Production Checklist

- [x] All tests passing (562/562) ✅
- [x] CI/CD pipeline configured ✅
- [x] Docker images building successfully ✅
- [x] Multi-platform support (amd64 + arm64) ✅
- [x] Environment variables documented ✅
- [x] API documentation complete (Swagger) ✅
- [x] Database migrations ready ✅
- [x] Security measures implemented ✅
- [x] Comprehensive documentation ✅
- [x] Health checks configured ✅

---

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Last Updated:** November 3, 2025

