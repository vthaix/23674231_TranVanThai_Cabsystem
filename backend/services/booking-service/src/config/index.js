const PORT = Number(process.env.PORT || 3003);
const SERVICE_NAME = process.env.SERVICE_NAME || "booking-service";
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || "http://driver-service:3002";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://trip-service:3004";
module.exports = { PORT, SERVICE_NAME, DRIVER_SERVICE_URL, TRIP_SERVICE_URL };
