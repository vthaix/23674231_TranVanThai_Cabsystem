const { startGrpcServer } = require('../../../shared/src/grpc/transport');
const app = require("./app");
const { SERVICE_NAME } = require("./config");
const { checkDatabase } = require("./db/mongo");
const { connectKafka } = require("./workers/kafka.consumer");

async function start() {
  checkDatabase()
    .then(() => console.log(`${SERVICE_NAME} mongo connected`))
    .catch((err) => console.warn(`${SERVICE_NAME} mongo connection warning:`, err.message));

  await connectKafka();
  await startGrpcServer(SERVICE_NAME, {}, undefined, app);
}

start();
