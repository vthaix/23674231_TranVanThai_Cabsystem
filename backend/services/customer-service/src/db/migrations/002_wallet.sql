ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS balance BIGINT NOT NULL DEFAULT 1000000 CHECK (balance >= 0);
CREATE TABLE IF NOT EXISTS wallet_operations (
  operation_id VARCHAR(100) PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customer_profiles(id),
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
