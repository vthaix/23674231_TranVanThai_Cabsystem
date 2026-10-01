const express = require("express");
const { Kafka } = require("kafkajs");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase } = require("./db/mongo");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3006);
const SERVICE_NAME =
    process.env.SERVICE_NAME || "notification-service";

registerHealthRoutes(app, SERVICE_NAME);

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

const consumer = kafka.consumer({
    groupId: "notification-service"
});

async function connectKafka() {
    try {
        await consumer.connect();

        await consumer.subscribe({
            topic: "booking.events",
            fromBeginning: false
        });

        console.log(
            `${SERVICE_NAME} kafka subscribed: booking.events`
        );

        await consumer.run({
            eachMessage: async({ topic, partition, message }) => {
                const rawValue = message.value?.toString() || ""

                try {
                    const event = JSON.parse(rawValue);

                    console.log(
                        `[KAFKA] consumed topic=${topic} partition=${partition} eventType=${event.eventType} eventId=${event.eventId}`
                    );

                    console.log(
                        `[KAFKA] payload=${JSON.stringify(event)}`
                    );
                } catch (err) {
                    console.error(
                        `${SERVICE_NAME} invalid Kafka message:`,
                        err.message
                    );
                }
            }
        });
    } catch (err) {
        console.error(
            `${SERVICE_NAME} kafka connection failed:`,
            err.message
        );
    }
}

// =========================
// MongoDB
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
async function connectKafka() {
    try {
        await consumer.connect();

        await consumer.subscribe({
            topic: "booking.events",
            fromBeginning: false
        });

        console.log(
            `${SERVICE_NAME} kafka subscribed: booking.events`
        );

        consumer
            .run({
                eachMessage: async({ topic, partition, message }) => {
                    const rawValue = message.value?.toString() || "";

                    try {
                        const event = JSON.parse(rawValue);

                        console.log(
                            `[KAFKA] consumed topic=${topic} partition=${partition} eventType=${event.eventType} eventId=${event.eventId}`
                        );

                        console.log(
                            `[KAFKA] payload=${JSON.stringify(event)}`
                        );
                    } catch (err) {
                        console.error(
                            `${SERVICE_NAME} invalid Kafka message:`,
                            err.message
                        );
                    }
                }
            })
            .catch((err) => {
                console.error(
                    `${SERVICE_NAME} kafka consumer failed:`,
                    err.message
                );
            });
    } catch (err) {
        console.error(
            `${SERVICE_NAME} kafka connection failed:`,
            err.message
        );
    }
}

async function start() {
    await connectKafka();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
}

start();