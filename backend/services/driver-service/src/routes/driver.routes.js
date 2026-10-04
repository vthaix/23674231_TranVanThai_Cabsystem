const express = require("express");
const controller = require("../controllers/driver.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/drivers/otp/request", controller.postDriversOtpRequest);
router.post("/drivers/otp/verify", controller.postDriversOtpVerify);
router.post("/drivers/register", controller.postDriversRegister);
router.get("/drivers", requireAuth, controller.getDrivers);
router.get("/drivers/me", requireAuth, controller.getDriversMe);
router.get("/drivers/:id/application", requireAuth, controller.getAdminDriversId);
router.post("/drivers/:id/approve", requireAuth, controller.postAdminDriversIdApprove);
router.post("/drivers/:id/reject", requireAuth, controller.postAdminDriversIdReject);
router.put("/drivers/me/availability", requireAuth, controller.putDriversMeAvailability);
router.put("/drivers/me/location", requireAuth, controller.putDriversMeLocation);
router.get("/drivers/nearby", controller.getDriversNearby);
router.get("/drivers/:id", requireAuth, controller.getDriversId);

module.exports = router;
