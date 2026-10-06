ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_payment_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_payment_status_check
  CHECK (payment_status IN ('UNPAID', 'HELD', 'PAID', 'REFUNDED'));
