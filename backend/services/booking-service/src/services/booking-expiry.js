const { generateServiceToken } = require('../../../../shared/src/auth/jwt');
const { SERVICE_NAME, DRIVER_SERVICE_URL } = require('../config');

async function expireRows(client, rows) {
  const releases = [];
  for (const booking of rows) {
    const offers = await client.query(`UPDATE offers SET status='EXPIRED',updated_at=NOW()
      WHERE booking_id=$1 AND status='PENDING' RETURNING driver_id`, [booking.id]);
    await client.query(`UPDATE bookings SET status='EXPIRED',updated_at=NOW()
      WHERE id=$1 AND status='SEARCHING'`, [booking.id]);
    await client.query(`INSERT INTO booking_status_history(booking_id,from_status,to_status,reason)
      VALUES($1,'SEARCHING','EXPIRED','SEARCH_TIMEOUT')`, [booking.id]);
    for (const offer of offers.rows) releases.push({ bookingId: booking.id, driverId: offer.driver_id });
  }
  return releases;
}

async function expireCustomerSearches(client, customerId) {
  const { rows } = await client.query(`SELECT id FROM bookings
    WHERE customer_id=$1 AND status='SEARCHING' AND search_expires_at<=NOW()
    FOR UPDATE`, [customerId]);
  return expireRows(client, rows);
}

async function releaseReservations(releases) {
  if (!releases.length) return;
  const token = generateServiceToken(SERVICE_NAME, 'driver-service');
  await Promise.allSettled(releases.map(({ bookingId, driverId }) =>
    fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${driverId}/reservations/${bookingId}`, {
      method: 'DELETE', headers: { 'x-service-token': token }, signal: AbortSignal.timeout(3000),
    })));
}

let running = false;
async function expireStaleSearches(pool) {
  if (running) return;
  running = true;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id FROM bookings
      WHERE status='SEARCHING' AND search_expires_at<=NOW()
      ORDER BY search_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED`);
    const releases = await expireRows(client, rows);
    await client.query('COMMIT');
    await releaseReservations(releases);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[booking/expiry]', error.message);
  } finally {
    client?.release();
    running = false;
  }
}

module.exports = { expireCustomerSearches, expireStaleSearches, releaseReservations };
