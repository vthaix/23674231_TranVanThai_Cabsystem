const express = require("express");
const controller = require("../controllers/identity.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/auth/register", controller.postAuthRegister);
router.post("/auth/login", controller.postAuthLogin);
router.get("/admin/me", requireAuth, controller.getAdminMe);

module.exports = router;
