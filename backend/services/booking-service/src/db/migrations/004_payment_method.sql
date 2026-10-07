ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'BANK';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IN ('CASH', 'BANK'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('UNPAID', 'HELD', 'REFUNDED', 'PAID'));
