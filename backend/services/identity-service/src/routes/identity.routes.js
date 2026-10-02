const express = require("express");
const controller = require("../controllers/identity.controller");

const router = express.Router();
router.post("/auth/register", controller.postAuthRegister);
router.post("/auth/login", controller.postAuthLogin);

module.exports = router;
