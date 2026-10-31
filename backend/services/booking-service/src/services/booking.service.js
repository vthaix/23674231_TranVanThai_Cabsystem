const { rpcRequest } = require('../../../../shared/src/grpc/transport');
const repository = require("../repositories/booking.repository");
const crypto = require("crypto");
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME, OFFER_TTL_SEC } = require("../config");

async function dispatchBooking(bookingId, client) {
  try {
    const { rows } = await repository.findBookings(client, [bookingId]);
    if (rows.length === 0) return;
    const booking = rows[0];
    if (booking.status !== "SEARCHING" || new Date(booking.search_expires_at) <= new Date()) return;

    // Get drivers already offered
    const offersRes = await repository.findOffers5(client, [bookingId]);
    const excludeIds = offersRes.rows.map(r => r.driver_id).join(",");

    // Call Driver Service nearby
    const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
    const nearbyRequest = { lat: Number(booking.pickup_lat), lng: Number(booking.pickup_lng), vehicleType: booking.vehicle_type, excludeIds };

    const resp = await rpcRequest('driver-service', 'FindNearby', nearbyRequest, {
      headers: { "x-service-token": svcToken }
    });

    if (!resp.ok) return;
    const { candidates } = await resp.json();
    if (!candidates || candidates.length === 0) {
      // Check attempt count
      if (booking.attempt_count >= 5) {
        await repository.updateBookings3(client, [bookingId]);
      }
      return;
    }

    const targetDriver = candidates[0];

    // Reserve driver
    const reserveResp = await rpcRequest('driver-service', 'ReserveDriver', { id: targetDriver.id }, {
      headers: {
        "content-type": "application/json",
        "x-service-token": svcToken
      },
      body: JSON.stringify({ bookingId })
    });

    if (!reserveResp.ok) return; // Driver was taken

    const attemptNo = (booking.attempt_count || 0) + 1;
    const expiresAt = new Date(Date.now() + OFFER_TTL_SEC * 1000);

    // Create Offer
    await repository.insertOffers(client, [
      bookingId, targetDriver.id, attemptNo,
      targetDriver.distanceM, targetDriver.etaSeconds, expiresAt
    ]);

    await repository.updateBookings4(client, [attemptNo, expiresAt, bookingId]);

    console.log(`[DISPATCH] Sent offer for booking ${bookingId} to driver ${targetDriver.id}`);
  } catch (e) {
    console.warn(`[DISPATCH] error for booking ${bookingId}:`, e.message);
  }
}

module.exports = { dispatchBooking };
