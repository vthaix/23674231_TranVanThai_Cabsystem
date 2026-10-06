const PORT = Number(process.env.PORT || 3005);
const SERVICE_NAME = process.env.SERVICE_NAME || "payment-service";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://trip-service:3004";
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://customer-service:3001';
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3002';
const PAYMENT_CALLBACK_SECRET = process.env.PAYMENT_CALLBACK_SECRET || "dev-callback-secret-key-32b!";
module.exports = { PORT, SERVICE_NAME, TRIP_SERVICE_URL, CUSTOMER_SERVICE_URL, DRIVER_SERVICE_URL, PAYMENT_CALLBACK_SECRET };
