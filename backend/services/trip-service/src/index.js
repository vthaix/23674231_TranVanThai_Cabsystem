const app = require("./app");
const { PORT, SERVICE_NAME } = require("./config");
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
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[trip-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
