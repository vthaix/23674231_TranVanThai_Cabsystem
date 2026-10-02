const app = require("./app");
const { PORT, SERVICE_NAME } = require("./config");
const { checkDatabase } = require("./db/mongo");
const { connectKafka } = require("./workers/kafka.consumer");

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
