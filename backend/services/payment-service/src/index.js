const app = require("./app");
const { PORT, SERVICE_NAME } = require("./config");
const { runMigrations } = require("./db/postgres");

async function start() {
  try {
    await runMigrations();
    console.log("[payment-service] Migrations applied");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[payment-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
