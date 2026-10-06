const { generateServiceToken } = require('../../../../shared/src/auth/jwt');
const { SERVICE_NAME, DRIVER_SERVICE_URL, TRIP_SERVICE_URL } = require('../config');
const escrowClient = require('./escrow.client');

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
    const terminal = await client.query(`SELECT id,status,trip_id,current_driver_id FROM bookings
      WHERE status IN ('EXPIRED','CANCELED','COMPLETED') AND payment_status='HELD'
      ORDER BY updated_at DESC LIMIT 100`);
    for (const booking of terminal.rows) {
      try {
        if (booking.status === 'COMPLETED' && booking.trip_id && booking.current_driver_id) {
          await escrowClient.settle(booking.id, booking.trip_id, booking.current_driver_id);
        } else if (booking.status !== 'COMPLETED') {
          await escrowClient.refund(booking.id);
        }
        if (booking.trip_id) {
          const tripStatus = booking.status === 'COMPLETED' ? 'PAID' : 'REFUNDED';
          const tripResponse = await fetch(`${TRIP_SERVICE_URL}/internal/trips/${booking.trip_id}/payment-status`, {
            method: 'POST',
            headers: { 'content-type': 'application/json',
              'x-service-token': generateServiceToken(SERVICE_NAME, 'trip-service') },
            body: JSON.stringify({ status: tripStatus }),
            signal: AbortSignal.timeout(3000)
          });
          if (!tripResponse.ok) throw new Error(`Trip payment sync returned ${tripResponse.status}`);
        }
        await client.query('UPDATE bookings SET payment_status=$2 WHERE id=$1',
          [booking.id, booking.status === 'COMPLETED' ? 'PAID' : 'REFUNDED']);
      } catch (error) {
        if (error.status !== 404 && error.status !== 409) console.warn('[booking/escrow-reconcile]', booking.id, error.message);
      }
    }
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[booking/expiry]', error.message);
  } finally {
    client?.release();
    running = false;
  }
}

module.exports = { expireCustomerSearches, expireStaleSearches, releaseReservations };
