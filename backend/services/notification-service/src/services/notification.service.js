const crypto = require("crypto");
const notificationRepository = require("../repositories/notification.repository");

// In-memory fallback if Mongo is offline.
const inMemNotifications = [];

async function saveNotification(notif) {
  notif.id = notif.id || crypto.randomUUID();
  notif.isRead = false;
  notif.createdAt = notif.createdAt || new Date().toISOString();
  inMemNotifications.unshift(notif);

  try {
    await notificationRepository.insert(notif);
  } catch {
    // Keep in memory.
  }
}

async function listNotifications(userId, unreadOnly, limit) {
  try {
    return await notificationRepository.findByRecipient(userId, unreadOnly, limit);
  } catch {
    let notifications = inMemNotifications.filter(n => n.recipientId === userId);
    if (unreadOnly === "true") notifications = notifications.filter(n => !n.isRead);
    return notifications.slice(0, Number(limit));
  }
}

async function markNotificationRead(id, userId) {
  try {
    await notificationRepository.markRead(id, userId);
  } catch {}

  const mem = inMemNotifications.find(n => n.id === id && n.recipientId === userId);
  if (mem) {
    mem.isRead = true;
    mem.readAt = new Date().toISOString();
  }
}

module.exports = { saveNotification, listNotifications, markNotificationRead };
