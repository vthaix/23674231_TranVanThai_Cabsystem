const PORT = Number(process.env.PORT || 3003);
const SERVICE_NAME = process.env.SERVICE_NAME || "booking-service";
const OFFER_TTL_SEC = Number(process.env.OFFER_TTL_SEC || 1800);
module.exports = { PORT, SERVICE_NAME, OFFER_TTL_SEC };
