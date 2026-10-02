CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_enc TEXT,
  phone_hash CHAR(64) UNIQUE NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  avatar_url VARCHAR(500),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_email_unique ON customer_profiles (lower(email));

CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  topic VARCHAR(60),
  event_type VARCHAR(60),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
