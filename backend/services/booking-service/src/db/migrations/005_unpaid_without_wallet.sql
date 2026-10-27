UPDATE bookings SET payment_status='UNPAID',updated_at=NOW()
WHERE payment_status='HELD';
