-- HTML escaping can expand a user-supplied reason beyond the old 40/255 limits.
ALTER TABLE bookings ALTER COLUMN cancel_reason TYPE TEXT;
ALTER TABLE booking_status_history ALTER COLUMN reason TYPE TEXT;
