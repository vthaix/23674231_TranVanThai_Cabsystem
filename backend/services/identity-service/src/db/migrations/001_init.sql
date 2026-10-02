-- Identity Service Database Migration
-- Run order: 001

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255),
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  code VARCHAR(80) PRIMARY KEY,
  resource VARCHAR(40) NOT NULL,
  action VARCHAR(40) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  phone_hash CHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'LOCKED')),
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  lock_reason VARCHAR(255),
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on lower(email)
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique ON accounts (lower(email)) WHERE email IS NOT NULL;

-- Account Roles
CREATE TABLE IF NOT EXISTS account_roles (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role_code VARCHAR(30) NOT NULL REFERENCES roles(code),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, role_code)
);

-- Unique: one primary role per account
CREATE UNIQUE INDEX IF NOT EXISTS account_roles_primary_unique ON account_roles (account_id) WHERE is_primary = TRUE;

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_code VARCHAR(30) NOT NULL REFERENCES roles(code),
  permission_code VARCHAR(80) NOT NULL REFERENCES permissions(code),
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_code, permission_code)
);

-- Outbox Events
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

-- Audit Logs
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

CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
