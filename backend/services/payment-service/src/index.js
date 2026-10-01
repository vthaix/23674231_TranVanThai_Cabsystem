const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || "payment-service";

registerHealthRoutes(app, SERVICE_NAME);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
