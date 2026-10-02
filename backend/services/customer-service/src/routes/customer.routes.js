const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { getCustomer } = require("../controllers/customer.controller");

const router = express.Router();
router.get("/customers/:id", requireAuth, getCustomer);

module.exports = router;
