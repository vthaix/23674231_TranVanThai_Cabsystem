ALTER TABLE drivers ALTER COLUMN national_id_hash DROP NOT NULL;
ALTER TABLE drivers ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0);
CREATE TABLE IF NOT EXISTS wallet_operations (
  operation_id VARCHAR(100) PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES drivers(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
