const { v4: uuid } = require("uuid");
const { store } = require("../data/store");

function notify(userId, type, title, message) {
  const notification = {
    notificationId: uuid(),
    userId,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };

  store.notifications.push(notification);
  return notification;
}

module.exports = { notify };
