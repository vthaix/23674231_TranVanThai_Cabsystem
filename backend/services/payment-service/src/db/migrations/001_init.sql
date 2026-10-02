CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  method VARCHAR(20) NOT NULL DEFAULT 'ONLINE' CHECK (method IN ('ONLINE')),
  payment_method_id UUID,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  failure_code VARCHAR(50),
  failure_message VARCHAR(255),
  provider VARCHAR(40) NOT NULL DEFAULT 'MOCK_PAYMENT',
  provider_transaction_id VARCHAR(100) UNIQUE,
  idempotency_key VARCHAR(100),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_active_trip_uq ON payments (trip_id) WHERE status IN ('PENDING', 'COMPLETED');
CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  provider VARCHAR(40) NOT NULL,
  provider_event_id VARCHAR(100),
  provider_transaction_id VARCHAR(100),
  event_type VARCHAR(50),
  result VARCHAR(10),
  amount BIGINT,
  signature VARCHAR(128),
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB,
  status VARCHAR(10) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'REJECTED')),
  error_message VARCHAR(500),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_uq ON webhook_events (provider, provider_event_id) WHERE signature_valid;

CREATE TABLE IF NOT EXISTS idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(40) NOT NULL,
  endpoint VARCHAR(60) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'IN_PROGRESS',
  response_code SMALLINT,
  response_body JSONB,
  resource_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE (scope, endpoint, idempotency_key)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(40) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  event_version SMALLINT NOT NULL DEFAULT 1,
  topic VARCHAR(60) NOT NULL,
  partition_key VARCHAR(80),
  payload JSONB NOT NULL,
  request_id VARCHAR(64),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events (status, created_at) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  topic VARCHAR(60),
  event_type VARCHAR(60),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
