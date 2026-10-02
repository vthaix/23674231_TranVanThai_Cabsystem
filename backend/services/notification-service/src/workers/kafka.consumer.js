const { Kafka } = require("kafkajs");
const { SERVICE_NAME } = require("../config");
const { saveNotification } = require("../services/notification.service");

const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const kafka = new Kafka({ clientId: SERVICE_NAME, brokers });
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

module.exports = { connectKafka };
