const { client: mongoClient } = require("../db/mongo");

async function insert(notification) {
  const db = mongoClient.db("notification_db");
  await db.collection("notifications").insertOne(notification);
}

async function findByRecipient(userId, unreadOnly, limit) {
  const db = mongoClient.db("notification_db");
  const filter = { recipientId: userId };
  if (unreadOnly === "true") filter.isRead = false;
  return db.collection("notifications")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .toArray();
}

async function markRead(id, userId) {
  const db = mongoClient.db("notification_db");
  await db.collection("notifications").updateOne(
    { id, recipientId: userId },
    { $set: { isRead: true, readAt: new Date().toISOString() } }
  );
}

module.exports = { insert, findByRecipient, markRead };
