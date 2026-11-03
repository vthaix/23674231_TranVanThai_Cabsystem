ALTER TABLE drivers ALTER COLUMN email TYPE TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email_hash CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS drivers_email_hash_unique
  ON drivers (email_hash) WHERE email_hash IS NOT NULL;
