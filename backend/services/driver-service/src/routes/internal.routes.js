const express = require("express");
const controller = require("../controllers/driver.controller");
const { requireInternalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get("/internal/drivers/nearby", requireInternalAuth, controller.getInternalDriversNearby);
router.post("/internal/drivers/:id/reservations", requireInternalAuth, controller.postInternalDriversIdReservations);
router.delete("/internal/drivers/:id/reservations/:bookingId", requireInternalAuth, controller.deleteInternalDriversIdReservationsBookingid);
router.post("/internal/drivers/:id/busy", requireInternalAuth, controller.postInternalDriversIdBusy);
router.get("/internal/drivers/:id/summary", requireInternalAuth, controller.getInternalDriversIdSummary);

module.exports = router;
