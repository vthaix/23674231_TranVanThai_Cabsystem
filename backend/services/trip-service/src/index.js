const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const grpcHandlers = { ...require('./services/trip.handlers') };
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { runMigrations, pool } = require("./db/postgres");
const { seed } = require("./db/seed");
const { producer } = require("./events/kafka.producer");
const { startOutboxRelay } = require("../../../shared/src/events/outbox");

async function start() {
  try {
    await runMigrations();
    console.log("[trip-service] Migrations applied");
    await seed();
    try {
      await producer.connect();
      startOutboxRelay(pool, producer);
    } catch (error) {
      console.warn(`[trip-service] Kafka relay unavailable: ${error.message}`);
    }
    await startGrpcServer(SERVICE_NAME, grpcHandlers, undefined, app);
  } catch (err) {
    console.error("[trip-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
