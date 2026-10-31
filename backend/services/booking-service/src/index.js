const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const grpcHandlers = { ...require('./services/booking.handlers'), ...require('./services/booking-payment') };
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { runMigrations, pool } = require("./db/postgres");
const { expireStaleSearches } = require("./services/booking-expiry");
const { seed } = require("./db/seed");
const { connectKafka } = require("./events/kafka.producer");

async function start() {
  try {
    await runMigrations();
    console.log("[booking-service] Migrations applied");
    await seed();
    await connectKafka();
    await startGrpcServer(SERVICE_NAME, grpcHandlers, undefined, app);
    await expireStaleSearches(pool);
    setInterval(() => expireStaleSearches(pool), 10_000).unref();
  } catch (err) {
    console.error("[booking-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
