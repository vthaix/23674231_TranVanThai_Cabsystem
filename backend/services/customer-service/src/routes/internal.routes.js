const express = require("express");
const { requireServiceAuth } = require("../middlewares/auth.middleware");
const { createCustomer } = require("../controllers/customer.controller");

const router = express.Router();
router.post("/internal/customers", requireServiceAuth, createCustomer);

module.exports = router;
