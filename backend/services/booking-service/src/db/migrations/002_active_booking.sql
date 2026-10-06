ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('SEARCHING', 'ASSIGNED', 'NO_DRIVER_FOUND', 'COMPLETED', 'CANCELED', 'EXPIRED'));

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS search_expires_at TIMESTAMPTZ;
UPDATE bookings SET search_expires_at = created_at + INTERVAL '30 minutes'
WHERE status = 'SEARCHING' AND search_expires_at IS NULL;

-- Preserve genuine accepted trips. An older demo ASSIGNED row without a trip
-- yields to its customer's SEARCHING row; other duplicate active rows expire.
WITH ranked AS (
  SELECT id, status, ROW_NUMBER() OVER (
    PARTITION BY customer_id
    ORDER BY CASE WHEN status = 'ASSIGNED' AND trip_id IS NOT NULL THEN 0
                  WHEN status = 'SEARCHING' THEN 1 ELSE 2 END,
             created_at DESC, id
  ) AS position
  FROM bookings WHERE status IN ('SEARCHING', 'ASSIGNED')
), changed AS (
  UPDATE bookings b SET
    status = CASE WHEN b.status = 'SEARCHING' THEN 'EXPIRED' ELSE 'CANCELED' END,
    canceled_at = CASE WHEN b.status = 'ASSIGNED' THEN NOW() ELSE b.canceled_at END,
    cancel_reason = CASE WHEN b.status = 'ASSIGNED' THEN 'DEMO_CONFLICT' ELSE b.cancel_reason END,
    updated_at = NOW()
  FROM ranked r WHERE b.id = r.id AND r.position > 1
  RETURNING b.id, b.status
)
INSERT INTO booking_status_history(booking_id,from_status,to_status,reason)
SELECT id, CASE WHEN status = 'EXPIRED' THEN 'SEARCHING' ELSE 'ASSIGNED' END,
       status, 'ACTIVE_BOOKING_CONSTRAINT' FROM changed;

WITH changed AS (
  UPDATE bookings SET status = 'EXPIRED', updated_at = NOW()
  WHERE status = 'SEARCHING' AND search_expires_at <= NOW()
  RETURNING id
)
INSERT INTO booking_status_history(booking_id,from_status,to_status,reason)
SELECT id, 'SEARCHING', 'EXPIRED', 'SEARCH_TIMEOUT' FROM changed;

UPDATE offers SET status = 'EXPIRED', updated_at = NOW()
WHERE status = 'PENDING' AND booking_id IN
  (SELECT id FROM bookings WHERE status = 'EXPIRED');
UPDATE offers SET status = 'CANCELED', updated_at = NOW()
WHERE status = 'PENDING' AND booking_id IN
  (SELECT id FROM bookings WHERE status = 'CANCELED');

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_customer
  ON bookings(customer_id) WHERE status IN ('SEARCHING', 'ASSIGNED');
CREATE INDEX IF NOT EXISTS bookings_search_expiry_idx
  ON bookings(search_expires_at) WHERE status = 'SEARCHING';
