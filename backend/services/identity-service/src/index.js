const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const grpcHandlers = { ...require('./services/identity.handlers') };
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { runMigrations } = require("./db/postgres");
const { seed } = require("./db/seed");

async function start() {
  try {
    await runMigrations();
    console.log("[identity] Migrations applied");
    await seed();
    await startGrpcServer(SERVICE_NAME, grpcHandlers, undefined, app);
  } catch (err) {
    // Log the full error: some startup failures (for example, a rejected
    // connection promise) may not expose a useful `message` property.
    console.error("[identity] Startup error:", err);
    process.exit(1);
  }
}

start();
