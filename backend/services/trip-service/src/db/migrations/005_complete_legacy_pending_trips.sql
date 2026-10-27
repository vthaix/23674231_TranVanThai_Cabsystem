UPDATE trips
SET status='COMPLETED', completed_at=COALESCE(completed_at,NOW()), updated_at=NOW()
WHERE status='PAYMENT_PENDING';

UPDATE trips SET payment_status='UNPAID',updated_at=NOW()
WHERE payment_status='HELD';
