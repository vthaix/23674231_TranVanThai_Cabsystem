CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fare_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type VARCHAR(10) NOT NULL,
  base_fare BIGINT NOT NULL CHECK (base_fare >= 0),
  per_km BIGINT NOT NULL CHECK (per_km >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY,
  booking_id UUID UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  vehicle_id UUID,
  driver_snapshot JSONB,
  vehicle_type VARCHAR(10) NOT NULL,
  pickup_address VARCHAR(500) NOT NULL,
  pickup_lat NUMERIC(9,6) NOT NULL,
  pickup_lng NUMERIC(9,6) NOT NULL,
  destination_address VARCHAR(500) NOT NULL,
  destination_lat NUMERIC(9,6) NOT NULL,
  destination_lng NUMERIC(9,6) NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL,
  estimated_duration_sec INT,
  fare_rule_id UUID,
  base_fare BIGINT NOT NULL,
  per_km_fare BIGINT NOT NULL,
  fare BIGINT NOT NULL CHECK (fare > 0),
  currency CHAR(3) DEFAULT 'VND',
  status VARCHAR(12) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')),
  payment_id UUID,
  payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID', 'PAID')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason VARCHAR(500),
  canceled_by_id UUID,
  canceled_by_role VARCHAR(30),
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_customer_idx ON trips (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trips_driver_idx ON trips (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trips_status_idx ON trips (status);

CREATE TABLE IF NOT EXISTS trip_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  from_status VARCHAR(12),
  to_status VARCHAR(12) NOT NULL,
  actor_id UUID,
  actor_role VARCHAR(30),
  reason VARCHAR(500),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  distance_to_target_m INT,
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID UNIQUE NOT NULL REFERENCES trips(id),
  customer_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_driver_idx ON reviews (driver_id, created_at DESC);

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
