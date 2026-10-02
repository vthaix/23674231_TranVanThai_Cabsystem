const express = require("express");
const controller = require("../controllers/payment.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/payments", requireAuth, controller.postPayments);
router.post("/payments/callback", controller.postPaymentsCallback);
router.get("/payments/:id", requireAuth, controller.getPaymentsId);

module.exports = router;
