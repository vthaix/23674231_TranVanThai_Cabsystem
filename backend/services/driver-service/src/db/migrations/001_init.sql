CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY,
  phone_enc TEXT,
  phone_hash CHAR(64) UNIQUE NOT NULL,
  national_id_enc TEXT,
  national_id_hash CHAR(64) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  date_of_birth DATE NOT NULL,
  license_number_enc TEXT,
  license_class VARCHAR(20) NOT NULL,
  license_expiry_date DATE NOT NULL,
  avatar_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL', 'REJECTED', 'OFFLINE', 'ONLINE', 'BUSY')),
  current_trip_id UUID,
  rating_count INT NOT NULL DEFAULT 0,
  rating_sum NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  completed_trips INT NOT NULL DEFAULT 0,
  rejected_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  last_online_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('BIKE', 'SEDAN', 'SUV', 'MOTORBIKE', 'CAR_4', 'CAR_7', 'VAN')),
  plate_number VARCHAR(20) UNIQUE NOT NULL,
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  color VARCHAR(30) NOT NULL,
  manufacture_year INT NOT NULL,
  seat_count INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES drivers(id),
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  heading NUMERIC(6,2),
  speed_kmh NUMERIC(5,1),
  accuracy_m NUMERIC(6,1),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS driver_locations_coords_idx ON driver_locations (latitude, longitude);

CREATE TABLE IF NOT EXISTS driver_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID,
  changed_by_role VARCHAR(30),
  reason TEXT,
  trip_id UUID,
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_role VARCHAR(30),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(40),
  target_id UUID,
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  request_id VARCHAR(64),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
