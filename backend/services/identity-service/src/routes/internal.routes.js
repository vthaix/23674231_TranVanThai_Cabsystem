const express = require("express");
const controller = require("../controllers/identity.controller");
const { requireServiceAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/internal/accounts", requireServiceAuth, controller.postInternalAccounts);
router.get("/internal/roles/:role/permissions", controller.getInternalRolesRolePermissions);

module.exports = router;
