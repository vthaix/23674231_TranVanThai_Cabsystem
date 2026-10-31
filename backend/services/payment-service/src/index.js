const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { runMigrations } = require("./db/postgres");

async function start() {
  try {
    await runMigrations();
    console.log("[payment-service] Migrations applied");
    await startGrpcServer(SERVICE_NAME, {}, undefined, app);
  } catch (err) {
    console.error("[payment-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
