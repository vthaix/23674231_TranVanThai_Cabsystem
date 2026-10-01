const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase } = require("./db/postgres");
const { checkRedis } = require("./db/redis");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3004);
const SERVICE_NAME = process.env.SERVICE_NAME || "trip-service";

registerHealthRoutes(app, SERVICE_NAME);

checkDatabase()
  .then(() => {
    console.log("trip-service database connected");
  })
  .catch((err) => {
    console.error("trip-service database connection failed:", err.message);
  });

checkRedis()
  .then((result) => {
    console.log(`trip-service redis connected: ${result}`);
  })
  .catch((err) => {
    console.error("trip-service redis connection failed:", err.message);
  });

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});