const PORT = Number(process.env.PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || "identity-service";
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || "http://customer-service:3001";
module.exports = { PORT, SERVICE_NAME, CUSTOMER_SERVICE_URL };
