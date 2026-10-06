const PORT = Number(process.env.PORT || 3004);
const SERVICE_NAME = process.env.SERVICE_NAME || "trip-service";
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || "http://driver-service:3002";
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3003';
module.exports = { PORT, SERVICE_NAME, DRIVER_SERVICE_URL, BOOKING_SERVICE_URL };
