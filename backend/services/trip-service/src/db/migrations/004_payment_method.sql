ALTER TABLE trips ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'BANK';
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_payment_method_check;
ALTER TABLE trips ADD CONSTRAINT trips_payment_method_check
  CHECK (payment_method IN ('CASH', 'BANK'));
