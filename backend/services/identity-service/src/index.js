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
    console.error("[identity] Startup error:", err.message);
    process.exit(1);
  }
}

start();
