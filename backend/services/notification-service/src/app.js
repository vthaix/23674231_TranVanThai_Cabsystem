const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { sanitizeBody } = require("../../../shared/src/validation/index");
const { SERVICE_NAME } = require("./config");
const notificationRoutes = require("./routes/notification.routes");

const app = express();
app.use(express.json());
app.use(sanitizeBody);
registerHealthRoutes(app, SERVICE_NAME);
app.use(notificationRoutes);

module.exports = app;
