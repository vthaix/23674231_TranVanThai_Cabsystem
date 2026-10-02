const app = require("./app");
const { PORT, SERVICE_NAME } = require("./config");
const { runMigrations } = require("./db/postgres");
const { seed } = require("./db/seed");

async function start() {
  try {
    await runMigrations();
    console.log("[identity] Migrations applied");
    await seed();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[identity] Startup error:", err.message);
    process.exit(1);
  }
}

start();
