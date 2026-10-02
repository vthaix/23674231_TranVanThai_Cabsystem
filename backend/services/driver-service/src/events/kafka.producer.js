const { Kafka } = require("kafkajs");
const { SERVICE_NAME } = require("../config");

const producer = new Kafka({
  clientId: SERVICE_NAME,
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
}).producer();

module.exports = { producer };
