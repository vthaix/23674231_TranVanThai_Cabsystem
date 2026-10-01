const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URL);

async function checkDatabase() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  return true;
}

module.exports = { client, checkDatabase };
