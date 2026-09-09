const express = require("express");
const { auth } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();

router.get("/notifications", auth, (req, res) => {
  res.json(store.notifications.filter(n => n.userId === req.user.userId));
});

router.post("/notifications/:notificationId/read", auth, (req, res) => {
  const notification = store.notifications.find(
    n => n.notificationId === req.params.notificationId &&
         n.userId === req.user.userId
  );

  if (!notification) return res.status(404).json({ code: "NOT_FOUND", message: "Notification not found" });

  notification.read = true;
  res.json(notification);
});

module.exports = router;
