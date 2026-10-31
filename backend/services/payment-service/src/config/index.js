const PORT = Number(process.env.PORT || 3005);
const SERVICE_NAME = process.env.SERVICE_NAME || "payment-service";
const PAYMENT_CALLBACK_SECRET = process.env.PAYMENT_CALLBACK_SECRET || "dev-callback-secret-key-32b!";
module.exports = { PORT, SERVICE_NAME, PAYMENT_CALLBACK_SECRET };
