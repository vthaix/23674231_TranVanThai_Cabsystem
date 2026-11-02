-- Preserve the complete escaped reason and keep booking/trip history consistent.
ALTER TABLE trips ALTER COLUMN cancel_reason TYPE TEXT;
ALTER TABLE trip_status_history ALTER COLUMN reason TYPE TEXT;
