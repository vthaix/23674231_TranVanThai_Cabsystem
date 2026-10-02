const express = require("express");
const controller = require("../controllers/booking.controller");

const router = express.Router();
router.post("/internal/test-kafka", controller.postInternalTestKafka);

module.exports = router;
