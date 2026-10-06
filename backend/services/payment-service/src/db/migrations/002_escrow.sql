CREATE TABLE IF NOT EXISTS booking_escrows (
  booking_id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  driver_id UUID,
  trip_id UUID,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'HELD', 'REFUNDED', 'SETTLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
