const express = require("express");
const crypto = require("crypto");
const { Kafka } = require("kafkajs");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { client: mongoClient, checkDatabase } = require("./db/mongo");
const { verifyToken } = require("../../../shared/src/auth/jwt");
const { sanitizeBody } = require("../../../shared/src/validation/index");

const app = express();
app.use(express.json());
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3006);
const SERVICE_NAME = process.env.SERVICE_NAME || "notification-service";

registerHealthRoutes(app, SERVICE_NAME);

function errorResponse(res, status, code, message, requestId) {
  return res.status(status).json({ code, message, requestId });
}

// In-memory fallback if Mongo is offline
const inMemNotifications = [];

// Auth middleware for user JWT
function requireAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Bearer token required", requestId);
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid or expired token", requestId);
  }
}

// Add notification helper
async function saveNotification(notif) {
  notif.id = notif.id || crypto.randomUUID();
  notif.isRead = false;
  notif.createdAt = notif.createdAt || new Date().toISOString();

  inMemNotifications.unshift(notif);

  try {
    const db = mongoClient.db("notification_db");
    await db.collection("notifications").insertOne(notif);
  } catch (e) {
    // Keep in-memory
  }
}

// =========================
// API Endpoints
// =========================

// GET /notifications (filtered by sub of JWT)
app.get("/notifications", requireAuth, async (req, res) => {
  const { sub: userId } = req.user;
  const requestId = req.requestId;
  const { unreadOnly, page = 1, limit = 20 } = req.query;

  try {
    let notifications = [];
    try {
      const db = mongoClient.db("notification_db");
      const filter = { recipientId: userId };
      if (unreadOnly === "true") filter.isRead = false;
      notifications = await db.collection("notifications")
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .toArray();
    } catch {
      // Memory fallback
      notifications = inMemNotifications.filter(n => n.recipientId === userId);
      if (unreadOnly === "true") notifications = notifications.filter(n => !n.isRead);
      notifications = notifications.slice(0, Number(limit));
    }

    return res.json({
      data: notifications,
      requestId
    });
  } catch (err) {
    console.error("[notifications/list]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get notifications", requestId);
  }
});

// PATCH /notifications/:id/read
app.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const { sub: userId } = req.user;
  const { id } = req.params;
  const requestId = req.requestId;

  try {
    try {
      const db = mongoClient.db("notification_db");
      await db.collection("notifications").updateOne(
        { id, recipientId: userId },
        { $set: { isRead: true, readAt: new Date().toISOString() } }
      );
    } catch {}

    const mem = inMemNotifications.find(n => n.id === id && n.recipientId === userId);
    if (mem) {
      mem.isRead = true;
      mem.readAt = new Date().toISOString();
    }

    return res.json({ success: true, id, isRead: true, requestId });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to update notification", requestId);
  }
});

// =========================
// Kafka Consumer
// =========================
const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers
});

const consumer = kafka.consumer({ groupId: "notification-service" });

async function connectKafka() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "booking.events", fromBeginning: false });
    await consumer.subscribe({ topic: "trip.events", fromBeginning: false });
    await consumer.subscribe({ topic: "payment.events", fromBeginning: false });
    await consumer.subscribe({ topic: "driver.events", fromBeginning: false });

    console.log(`${SERVICE_NAME} kafka subscribed to events`);

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const raw = message.value?.toString() || "";
        try {
          const event = JSON.parse(raw);
          console.log(`[NOTIFICATION KAFKA] consumed ${topic} eventType=${event.eventType}`);

          // Create notification for recipients
          const data = event.data || event.payload || event;
          const recipients = [...new Set([...(data.recipientIds || []), data.customerId, data.driverId, data.userId].filter(Boolean))];
          for (const recipientId of recipients) {
            await saveNotification({
              recipientId,
              eventType: event.eventType || topic,
              title: `Event: ${event.eventType || topic}`,
              body: JSON.stringify(data),
              channel: "IN_APP"
            });
          }
        } catch (err) {
          console.warn("[NOTIFICATION] Parse error:", err.message);
        }
      }
    });
  } catch (err) {
    console.warn(`${SERVICE_NAME} kafka skipped/failed:`, err.message);
  }
}

// =========================
// Start
// =========================
async function start() {
  checkDatabase()
    .then(() => console.log(`${SERVICE_NAME} mongo connected`))
    .catch((err) => console.warn(`${SERVICE_NAME} mongo connection warning:`, err.message));

  await connectKafka();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`${SERVICE_NAME} listening on port ${PORT}`);
  });
}

start();
