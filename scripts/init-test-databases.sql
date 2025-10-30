-- Initialize test databases
CREATE DATABASE subscriptions_test_db;
CREATE DATABASE payments_test_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE subscriptions_test_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE payments_test_db TO postgres;

