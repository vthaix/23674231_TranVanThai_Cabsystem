const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const { getCustomer, getCustomerMe, listCustomers } = require("../controllers/customer.controller");

const router = express.Router();
router.get("/customers", requireAuth, listCustomers);
router.get("/customers/me", requireAuth, getCustomerMe);
router.get("/customers/:id", requireAuth, getCustomer);

module.exports = router;
