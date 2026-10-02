CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  vehicle_type VARCHAR(10) NOT NULL,
  pickup_address VARCHAR(500) NOT NULL,
  pickup_lat NUMERIC(9,6) NOT NULL,
  pickup_lng NUMERIC(9,6) NOT NULL,
  destination_address VARCHAR(500) NOT NULL,
  destination_lat NUMERIC(9,6) NOT NULL,
  destination_lng NUMERIC(9,6) NOT NULL,
  note VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'SEARCHING'
    CHECK (status IN ('SEARCHING', 'ASSIGNED', 'NO_DRIVER_FOUND', 'COMPLETED', 'CANCELED')),
  next_dispatch_at TIMESTAMPTZ,
  attempt_count SMALLINT DEFAULT 0,
  trip_id UUID,
  current_driver_id UUID,
  cancel_reason VARCHAR(40),
  canceled_by_id UUID,
  canceled_by_role VARCHAR(30),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status, created_at);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  driver_id UUID NOT NULL,
  attempt_no SMALLINT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED')),
  distance_to_pickup_m INT,
  eta_seconds INT,
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  reject_reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS offers_accepted_uq ON offers (booking_id) WHERE status = 'ACCEPTED';
CREATE UNIQUE INDEX IF NOT EXISTS offers_booking_driver_uq ON offers (booking_id, driver_id);
CREATE INDEX IF NOT EXISTS offers_driver_pending_idx ON offers (driver_id, status) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  reason VARCHAR(255),
  actor_id UUID,
  actor_role VARCHAR(30),
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
