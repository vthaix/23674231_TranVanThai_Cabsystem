const express = require("express");
const { registerHealthRoutes } = require("../../../shared/src/health");
const { sanitizeBody } = require("../../../shared/src/validation/index");
const { SERVICE_NAME } = require("./config");
const paymentRoutes = require("./routes/payment.routes");

const app = express();
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(sanitizeBody);
registerHealthRoutes(app, SERVICE_NAME);
app.use(paymentRoutes);
app.use(require('./routes/escrow.routes'));

module.exports = app;
