const { generateServiceToken } = require('../../../../shared/src/auth/jwt');
const { SERVICE_NAME, PAYMENT_SERVICE_URL, TRIP_SERVICE_URL } = require('../config');

async function call(path, body, method = 'POST') {
  const response = await fetch(`${PAYMENT_SERVICE_URL}/internal/escrows${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-service-token': generateServiceToken(SERVICE_NAME, 'payment-service') },
    body: method === 'GET' ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.code || 'ESCROW_ERROR');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function syncTripPayment(tripId, status) {
  const response = await fetch(`${TRIP_SERVICE_URL}/internal/trips/${tripId}/payment-status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json',
      'x-service-token': generateServiceToken(SERVICE_NAME, 'trip-service') },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Trip payment sync returned ${response.status}`);
}

module.exports = {
  hold: (bookingId, customerId, amount) => call('', { bookingId, customerId, amount }),
  refund: bookingId => call(`/${bookingId}/release`, { action: 'REFUND' }),
  settle: (bookingId, tripId, driverId) => call(`/${bookingId}/release`, { action: 'SETTLE', tripId, driverId }),
  get: bookingId => call(`/${bookingId}`, null, 'GET'),
  syncTripPayment
};
