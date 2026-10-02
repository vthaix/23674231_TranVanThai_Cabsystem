const express = require("express");
const controller = require("../controllers/driver.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get("/admin/drivers", requireAuth, controller.getAdminDrivers);
router.get("/admin/drivers/:id", requireAuth, controller.getAdminDriversId);
router.post("/admin/drivers/:id/approve", requireAuth, controller.postAdminDriversIdApprove);
router.post("/admin/drivers/:id/reject", requireAuth, controller.postAdminDriversIdReject);

module.exports = router;
