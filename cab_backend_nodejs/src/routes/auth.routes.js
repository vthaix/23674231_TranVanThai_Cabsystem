const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { store } = require("../data/store");
const { SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { fullName, phone, email, password, role } = req.body;

  if (!fullName || !phone || !email || !password || !["CUSTOMER", "DRIVER"].includes(role)) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid registration data" });
  }

  if (store.users.some(u => u.email === email)) {
    return res.status(409).json({ code: "EMAIL_EXISTS", message: "Email already exists" });
  }

  const userId = uuid();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    userId, fullName, phone, email, passwordHash,
    role, status: "ACTIVE",
    createdAt: new Date().toISOString()
  };

  store.users.push(user);

  const accessToken = jwt.sign(
    { userId, role, email },
    SECRET,
    { expiresIn: "2h" }
  );

  res.status(201).json({
    accessToken,
    tokenType: "Bearer",
    userId,
    role
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = store.users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" });
  }

  const accessToken = jwt.sign(
    { userId: user.userId, role: user.role, email: user.email },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    accessToken,
    tokenType: "Bearer",
    userId: user.userId,
    role: user.role
  });
});

module.exports = router;
