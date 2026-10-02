const { Kafka } = require("kafkajs");
const { pool } = require("../db/postgres");
const { startOutboxRelay } = require("../../../../shared/src/events/outbox");
const { SERVICE_NAME } = require("../config");

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
    startOutboxRelay(pool, producer);
    console.log(`${SERVICE_NAME} kafka connected: ${brokers.join(",")}`);
  } catch (err) {
    kafkaReady = false;
    console.warn(`${SERVICE_NAME} kafka connection skipped/failed:`, err.message);
  }
}

async function publishKafkaEvent(topic, key, event) {
  if (!kafkaReady) return;
  try {
    await producer.send({
      topic,
      messages: [{ key: String(key), value: JSON.stringify(event) }]
    });
  } catch (e) {
    console.warn(`[KAFKA] publish error ${topic}:`, e.message);
  }
}


function isKafkaReady() { return kafkaReady; }
module.exports = { producer, connectKafka, isKafkaReady };
