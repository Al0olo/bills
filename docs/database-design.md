# Database Design Documentation

## Overview

This document describes the database schema design for the microservices subscription billing system. The system uses two separate PostgreSQL databases - one for each microservice to maintain data isolation and service independence.

## Database Separation

### Subscription Service Database: `subscriptions_db`
Contains all user, plan, subscription, and payment record data.

### Payment Service Database: `payments_db`
Contains payment transaction data and processing logs.

---

## Subscription Service Database Schema

### Table: `users`

Stores user information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| name | VARCHAR(255) | NOT NULL | User full name |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password for authentication |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_email` on `email` (for login lookups)
- `idx_users_created_at` on `created_at` (for reporting)

---

### Table: `plans`

Stores subscription plan information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique plan identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Plan name (e.g., "Basic", "Pro") |
| description | TEXT | NULL | Plan description |
| price | DECIMAL(10,2) | NOT NULL, CHECK (price >= 0) | Plan price in dollars |
| billing_cycle | ENUM | NOT NULL | 'MONTHLY' or 'YEARLY' |
| features | JSONB | NULL | JSON array of feature strings |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether plan is available |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Plan creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_plans_is_active` on `is_active` (for active plan queries)
- `idx_plans_name` on `name` (for plan lookups)

---

### Table: `subscriptions`

Stores user subscription data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique subscription identifier |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id) | Reference to user |
| plan_id | UUID | NOT NULL, FOREIGN KEY → plans(id) | Reference to plan |
| status | ENUM | NOT NULL | 'PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED' |
| start_date | TIMESTAMP | NOT NULL | Subscription start date |
| end_date | TIMESTAMP | NULL | Subscription end date (NULL for active) |
| payment_gateway_id | VARCHAR(255) | NULL | External payment ID from payment service |
| previous_plan_id | UUID | NULL, FOREIGN KEY → plans(id) | Previous plan (for upgrades/downgrades) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Subscription creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_subscriptions_user_id` on `user_id` (for user subscription lookups)
- `idx_subscriptions_status` on `status` (for status filtering)
- `idx_subscriptions_start_date` on `start_date` (for date range queries)
- `idx_subscriptions_payment_gateway_id` on `payment_gateway_id` (for webhook processing)

**Constraints:**
- One active subscription per user: `UNIQUE (user_id) WHERE status = 'ACTIVE'`

---

### Table: `payment_records`

Stores payment attempt history for subscriptions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique payment record identifier |
| subscription_id | UUID | NOT NULL, FOREIGN KEY → subscriptions(id) | Reference to subscription |
| amount | DECIMAL(10,2) | NOT NULL, CHECK (amount >= 0) | Payment amount |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' | Currency code |
| status | ENUM | NOT NULL | 'PENDING', 'SUCCESS', 'FAILED' |
| payment_gateway_id | VARCHAR(255) | UNIQUE, NOT NULL | External payment ID |
| failure_reason | TEXT | NULL | Reason for payment failure |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Payment record creation |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_payment_records_subscription_id` on `subscription_id`
- `idx_payment_records_payment_gateway_id` on `payment_gateway_id` (for webhook lookups)
- `idx_payment_records_status` on `status`

---

### Table: `idempotency_keys`

Tracks idempotency keys to prevent duplicate operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique record identifier |
| idempotency_key | VARCHAR(255) | UNIQUE, NOT NULL | Client-provided idempotency key |
| request_method | VARCHAR(10) | NOT NULL | HTTP method (POST, PATCH, DELETE) |
| request_path | VARCHAR(500) | NOT NULL | API endpoint path |
| request_body_hash | VARCHAR(64) | NOT NULL | SHA-256 hash of request body |
| response_status | INTEGER | NULL | HTTP response status code |
| response_body | JSONB | NULL | Cached response body |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Key creation timestamp |
| expires_at | TIMESTAMP | NOT NULL | Expiration timestamp (24h from creation) |

**Indexes:**
- `idx_idempotency_keys_key` on `idempotency_key` (for quick lookups)
- `idx_idempotency_keys_expires_at` on `expires_at` (for cleanup job)

---

## Payment Service Database Schema

### Table: `payment_transactions`

Stores payment transaction data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique transaction identifier |
| external_reference | VARCHAR(255) | UNIQUE, NOT NULL | Reference from subscription service |
| amount | DECIMAL(10,2) | NOT NULL, CHECK (amount >= 0) | Transaction amount |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' | Currency code |
| status | ENUM | NOT NULL | 'PENDING', 'SUCCESS', 'FAILED' |
| webhook_sent | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether webhook was sent |
| webhook_retry_count | INTEGER | NOT NULL, DEFAULT 0 | Number of webhook retry attempts |
| webhook_last_attempt | TIMESTAMP | NULL | Last webhook attempt timestamp |
| metadata | JSONB | NULL | Additional transaction metadata |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Transaction creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_payment_transactions_external_ref` on `external_reference`
- `idx_payment_transactions_status` on `status`
- `idx_payment_transactions_webhook_sent` on `webhook_sent` (for retry processing)

---

### Table: `idempotency_keys`

Same structure as subscription service (duplicated for service independence).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique record identifier |
| idempotency_key | VARCHAR(255) | UNIQUE, NOT NULL | Client-provided idempotency key |
| request_method | VARCHAR(10) | NOT NULL | HTTP method (POST, PATCH, DELETE) |
| request_path | VARCHAR(500) | NOT NULL | API endpoint path |
| request_body_hash | VARCHAR(64) | NOT NULL | SHA-256 hash of request body |
| response_status | INTEGER | NULL | HTTP response status code |
| response_body | JSONB | NULL | Cached response body |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Key creation timestamp |
| expires_at | TIMESTAMP | NOT NULL | Expiration timestamp (24h from creation) |

**Indexes:**
- `idx_idempotency_keys_key` on `idempotency_key`
- `idx_idempotency_keys_expires_at` on `expires_at`

---

## Entity Relationship Diagram (ERD)

```
Subscription Service Database:
┌─────────────────┐
│     users       │
│─────────────────│
│ id (PK)         │
│ email (UNIQUE)  │
│ name            │
│ password_hash   │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │
         │ 1:N
         │
┌────────▼────────┐      N:1   ┌─────────────────┐
│ subscriptions   │─────────────▶│     plans       │
│─────────────────│              │─────────────────│
│ id (PK)         │              │ id (PK)         │
│ user_id (FK)    │              │ name (UNIQUE)   │
│ plan_id (FK)    │              │ description     │
│ status          │              │ price           │
│ start_date      │              │ billing_cycle   │
│ end_date        │              │ features (JSON) │
│ payment_gw_id   │              │ is_active       │
│ previous_plan   │              │ created_at      │
│ created_at      │              │ updated_at      │
│ updated_at      │              └─────────────────┘
└────────┬────────┘
         │
         │ 1:N
         │
┌────────▼────────────┐
│  payment_records    │
│─────────────────────│
│ id (PK)             │
│ subscription_id(FK) │
│ amount              │
│ currency            │
│ status              │
│ payment_gateway_id  │◀─┐ Links to Payment Service
│ failure_reason      │  │ (logical reference only)
│ created_at          │  │
│ updated_at          │  │
└─────────────────────┘  │
                         │
┌────────────────────────┴┐
│  idempotency_keys       │
│─────────────────────────│
│ id (PK)                 │
│ idempotency_key (UNIQUE)│
│ request_method          │
│ request_path            │
│ request_body_hash       │
│ response_status         │
│ response_body (JSON)    │
│ created_at              │
│ expires_at              │
└─────────────────────────┘

Payment Service Database:
┌──────────────────────────┐
│  payment_transactions    │
│──────────────────────────│
│ id (PK)                  │
│ external_reference(UNIQ) │◀─ References subscription
│ amount                   │   payment_records.payment_gateway_id
│ currency                 │
│ status                   │
│ webhook_sent             │
│ webhook_retry_count      │
│ webhook_last_attempt     │
│ metadata (JSON)          │
│ created_at               │
│ updated_at               │
└──────────────────────────┘

┌─────────────────────────┐
│  idempotency_keys       │
│─────────────────────────│
│ id (PK)                 │
│ idempotency_key (UNIQUE)│
│ request_method          │
│ request_path            │
│ request_body_hash       │
│ response_status         │
│ response_body (JSON)    │
│ created_at              │
│ expires_at              │
└─────────────────────────┘
```

---

## Transaction Boundaries

### Subscription Service Transactions

#### 1. Create Subscription
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - INSERT into subscriptions (status='PENDING')
  - INSERT into payment_records (status='PENDING')
  - INSERT into idempotency_keys
COMMIT;
```
**Rollback Scenario:** Any step fails → rollback entire transaction

#### 2. Update Subscription from Webhook
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - SELECT subscription by payment_gateway_id (with row lock)
  - UPDATE subscriptions.status
  - UPDATE payment_records.status
  - INSERT into idempotency_keys (for webhook)
COMMIT;
```
**Rollback Scenario:** Webhook idempotency check fails or status update fails

#### 3. Upgrade/Downgrade Subscription
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - SELECT current subscription (with row lock)
  - UPDATE subscriptions (set previous_plan_id, plan_id)
  - INSERT new payment_record
  - INSERT into idempotency_keys
COMMIT;
```
**Rollback Scenario:** Plan validation fails or payment initiation fails

#### 4. Cancel Subscription
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - SELECT subscription (with row lock)
  - UPDATE subscriptions.status = 'CANCELLED'
  - UPDATE subscriptions.end_date = NOW()
  - INSERT into idempotency_keys
COMMIT;
```

### Payment Service Transactions

#### 1. Initiate Payment
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - INSERT into payment_transactions (status='PENDING')
  - INSERT into idempotency_keys
  - Simulate payment processing
  - UPDATE payment_transactions.status
COMMIT;
```
**Rollback Scenario:** Simulation fails (unlikely in mock service)

#### 2. Send Webhook
**Transaction Scope:**
```
BEGIN TRANSACTION;
  - SELECT payment_transaction (with row lock)
  - UPDATE webhook_sent = TRUE
  - UPDATE webhook_retry_count
  - UPDATE webhook_last_attempt
COMMIT;
```

---

## Sample Seed Data

### Plans
```sql
INSERT INTO plans (id, name, description, price, billing_cycle, features, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Basic', 'Perfect for individuals', 9.99, 'MONTHLY', '["1 User", "10GB Storage", "Email Support"]', TRUE),
('550e8400-e29b-41d4-a716-446655440002', 'Pro', 'Great for small teams', 29.99, 'MONTHLY', '["5 Users", "100GB Storage", "Priority Support", "API Access"]', TRUE),
('550e8400-e29b-41d4-a716-446655440003', 'Enterprise', 'For large organizations', 99.99, 'MONTHLY', '["Unlimited Users", "1TB Storage", "24/7 Support", "API Access", "Custom Integrations"]', TRUE),
('550e8400-e29b-41d4-a716-446655440004', 'Basic Annual', 'Basic plan billed yearly', 99.99, 'YEARLY', '["1 User", "10GB Storage", "Email Support"]', TRUE),
('550e8400-e29b-41d4-a716-446655440005', 'Pro Annual', 'Pro plan billed yearly', 299.99, 'YEARLY', '["5 Users", "100GB Storage", "Priority Support", "API Access"]', TRUE);
```

### Users
```sql
INSERT INTO users (id, email, name, password_hash) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', 'John Doe', '$2b$10$hash1'),
('650e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', 'Jane Smith', '$2b$10$hash2'),
('650e8400-e29b-41d4-a716-446655440003', 'bob.wilson@example.com', 'Bob Wilson', '$2b$10$hash3');
```

### Subscriptions
```sql
INSERT INTO subscriptions (id, user_id, plan_id, status, start_date, payment_gateway_id) VALUES
('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'ACTIVE', NOW(), 'pay_abc123'),
('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'ACTIVE', NOW(), 'pay_def456');
```

---

## Migration Strategy

### Prisma Migrations
Use Prisma Migrate for schema management:

```bash
# Create migration
npx prisma migrate dev --name init

# Apply migration in production
npx prisma migrate deploy
```

### Migration Files Structure
```
prisma/
├── migrations/
│   ├── 20251029000001_init/
│   │   └── migration.sql
│   ├── 20251029000002_add_idempotency/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

---

## Performance Optimization

### Indexes
All indexes are defined in the table schemas above. Key indexes:
- Foreign key columns
- Status enums
- Frequently queried timestamp fields
- Unique constraints for idempotency

### Query Optimization
- Use `SELECT FOR UPDATE` when row-level locking is needed
- Implement connection pooling (Prisma handles this)
- Use prepared statements (Prisma handles this)
- Consider read replicas for read-heavy operations (future enhancement)

### Cleanup Jobs
- Schedule cleanup of expired idempotency keys (older than 24 hours)
- Archive old payment records (older than 1 year)

```sql
-- Cleanup query (run daily)
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

---

## Data Integrity Rules

1. **No orphaned subscriptions**: All subscriptions must reference valid users and plans
2. **Status consistency**: Payment records status must align with subscription status
3. **Idempotency enforcement**: Same idempotency key + request hash returns cached response
4. **Webhook reliability**: Failed webhooks retry up to 5 times with exponential backoff
5. **Transaction isolation**: Use READ COMMITTED for most operations, SERIALIZABLE for critical updates

