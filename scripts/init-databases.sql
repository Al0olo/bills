-- Create databases for both services
CREATE DATABASE subscriptions;
CREATE DATABASE payments;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE subscriptions TO postgres;
GRANT ALL PRIVILEGES ON DATABASE payments TO postgres;

