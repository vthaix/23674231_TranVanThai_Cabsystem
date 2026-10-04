const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { sanitizeBody } = require("../../../shared/src/validation/index");
const { SERVICE_NAME } = require("./config");
const driverRoutes = require("./routes/driver.routes");
const internalRoutes = require("./routes/internal.routes");

const app = express();
app.use(express.json());
app.use(sanitizeBody);
registerHealthRoutes(app, SERVICE_NAME);
app.use(driverRoutes);
app.use(internalRoutes);

module.exports = app;
