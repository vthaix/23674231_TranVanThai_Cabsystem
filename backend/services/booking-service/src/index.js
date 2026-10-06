const app = require("./app");
const { PORT, SERVICE_NAME } = require("./config");
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
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
    await expireStaleSearches(pool);
    setInterval(() => expireStaleSearches(pool), 10_000).unref();
  } catch (err) {
    console.error("[booking-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
