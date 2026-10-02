const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const controller = require("../controllers/notification.controller");

const router = express.Router();
router.get("/notifications", requireAuth, controller.list);
router.patch("/notifications/:id/read", requireAuth, controller.markRead);

module.exports = router;
