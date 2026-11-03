ALTER TABLE accounts ALTER COLUMN email TYPE TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_hash CHAR(64);
DROP INDEX IF EXISTS accounts_email_unique;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_hash_unique
  ON accounts (email_hash) WHERE email_hash IS NOT NULL;
