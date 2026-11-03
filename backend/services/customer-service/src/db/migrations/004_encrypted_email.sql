ALTER TABLE customer_profiles ALTER COLUMN email TYPE TEXT;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS email_hash CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_email_hash_unique
  ON customer_profiles (email_hash) WHERE email_hash IS NOT NULL;
DROP INDEX IF EXISTS customer_profiles_email_unique;
