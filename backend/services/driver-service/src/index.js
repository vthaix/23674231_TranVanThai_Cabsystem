const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase } = require("./db/postgres");
const { checkRedis } = require("./db/redis");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3002);
const SERVICE_NAME = process.env.SERVICE_NAME || "driver-service";

registerHealthRoutes(app, SERVICE_NAME);

checkDatabase()
  .then(() => {
    console.log("driver-service database connected");
  })
  .catch((err) => {
    console.error("driver-service database connection failed:", err.message);
  });

checkRedis()
  .then((result) => {
    console.log(`driver-service redis connected: ${result}`);
  })
  .catch((err) => {
    console.error("driver-service redis connection failed:", err.message);
  });

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});