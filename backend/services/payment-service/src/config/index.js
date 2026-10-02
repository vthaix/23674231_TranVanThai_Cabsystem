const PORT = Number(process.env.PORT || 3005);
const SERVICE_NAME = process.env.SERVICE_NAME || "payment-service";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://trip-service:3004";
const PAYMENT_CALLBACK_SECRET = process.env.PAYMENT_CALLBACK_SECRET || "dev-callback-secret-key-32b!";
module.exports = { PORT, SERVICE_NAME, TRIP_SERVICE_URL, PAYMENT_CALLBACK_SECRET };
