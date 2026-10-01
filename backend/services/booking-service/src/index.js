const express = require("express");
const crypto = require("crypto");
const { Kafka } = require("kafkajs");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase } = require("./db/postgres");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3003);
const SERVICE_NAME = process.env.SERVICE_NAME || "booking-service";

registerHealthRoutes(app, SERVICE_NAME);

// =========================
// Kafka Producer
// =========================
const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers
});

const producer = kafka.producer();

let kafkaReady = false;

async function connectKafka() {
  try {
    await producer.connect();
    kafkaReady = true;

    console.log(
      `${SERVICE_NAME} kafka connected: ${brokers.join(",")}`
    );
  } catch (err) {
    kafkaReady = false;
    console.error(
      `${SERVICE_NAME} kafka connection failed:`,
      err.message
    );
  }
}

// =========================
// Test Kafka Event Endpoint
// =========================
app.post("/internal/test-kafka", async (req, res) => {
  if (!kafkaReady) {
    return res.status(503).json({
      error: "Kafka is not ready"
    });
  }

  const event = {
    eventId: crypto.randomUUID(),
    eventType: "booking.test",
    occurredAt: new Date().toISOString(),
    producer: SERVICE_NAME,
    data: {
      bookingId: req.body.bookingId || "TEST-BOOKING-001",
      message: req.body.message || "Kafka PC7 test event"
    }
  };

  try {
    await producer.send({
      topic: "booking.events",
      messages: [{
        key: event.data.bookingId,
        value: JSON.stringify(event)
      }]
    });

    console.log(
      `[KAFKA] published ${event.eventType} eventId=${event.eventId}`
    );

    return res.status(202).json({
      status: "published",
      topic: "booking.events",
      event
    });
  } catch (err) {
    console.error(
      `${SERVICE_NAME} kafka publish failed:`,
      err.message
    );

    return res.status(500).json({
      error: "Kafka publish failed",
      message: err.message
    });
  }
});

// =========================
// PostgreSQL
// =========================
checkDatabase()
  .then(() => {
    console.log(`${SERVICE_NAME} database connected`);
  })
  .catch((err) => {
    console.error(
      `${SERVICE_NAME} database connection failed:`,
      err.message
    );
  });

// =========================
// Start
// =========================
async function start() {
  await connectKafka();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`${SERVICE_NAME} listening on port ${PORT}`);
  });
}

start();