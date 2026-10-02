const notificationService = require("../services/notification.service");
const { errorResponse } = require("../utils/errorResponse");

async function list(req, res) {
  const { sub: userId } = req.user;
  const requestId = req.requestId;
  const { unreadOnly, page = 1, limit = 20 } = req.query;

  try {
    const notifications = await notificationService.listNotifications(userId, unreadOnly, limit);
    return res.json({ data: notifications, requestId });
  } catch (err) {
    console.error("[notifications/list]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get notifications", requestId);
  }
}

async function markRead(req, res) {
  const { sub: userId } = req.user;
  const { id } = req.params;
  const requestId = req.requestId;

  try {
    await notificationService.markNotificationRead(id, userId);
    return res.json({ success: true, id, isRead: true, requestId });
  } catch {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to update notification", requestId);
  }
}

module.exports = { list, markRead };
