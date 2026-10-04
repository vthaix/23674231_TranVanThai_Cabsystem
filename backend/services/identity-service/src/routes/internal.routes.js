const express = require("express");
const controller = require("../controllers/identity.controller");
const { requireServiceAuth, requireDriverService } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/internal/accounts", requireServiceAuth, requireDriverService, controller.postInternalAccounts);
router.post("/internal/accounts/:id/activate", requireServiceAuth, requireDriverService, controller.postInternalAccountsIdActivate);
router.delete("/internal/accounts/:id", requireServiceAuth, requireDriverService, controller.deleteInternalAccountsId);
router.get("/internal/roles/:role/permissions", controller.getInternalRolesRolePermissions);

module.exports = router;
