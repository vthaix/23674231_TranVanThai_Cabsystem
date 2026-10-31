const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const grpcHandlers = { ...require('./controllers/customer.controller') };
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { runMigrations } = require("./db/postgres");
const { seed } = require("./db/seed");

async function start() {
  try {
    await runMigrations();
    console.log("[customer] Migrations applied");
    await seed();
    await startGrpcServer(SERVICE_NAME, grpcHandlers, undefined, app);
  } catch (err) {
    console.error("[customer] Startup error:", err.message);
    process.exit(1);
  }
}

start();
