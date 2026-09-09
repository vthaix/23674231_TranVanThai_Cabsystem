const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();

router.get("/users/me", auth, (req, res) => {
  const user = store.users.find(u => u.userId === req.user.userId);

  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

router.patch("/users/me", auth, (req, res) => {
  const user = store.users.find(u => u.userId === req.user.userId);

  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });

  Object.assign(user, {
    fullName: req.body.fullName ?? user.fullName,
    phone: req.body.phone ?? user.phone,
    email: req.body.email ?? user.email,
    updatedAt: new Date().toISOString()
  });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

router.patch("/operations/users/:userId/role", auth, allowRoles("ADMIN"), (req, res) => {
  const user = store.users.find(u => u.userId === req.params.userId);

  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });

  const allowed = ["CUSTOMER", "DRIVER", "OPERATIONS_STAFF", "ADMIN"];

  if (!allowed.includes(req.body.role)) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid role" });
  }

  user.role = req.body.role;
  res.json({ userId: user.userId, role: user.role });
});

module.exports = router;
