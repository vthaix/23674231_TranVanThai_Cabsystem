const { createClient } = require("redis");

let redis = null;

function getRedisClient() {
  if (!redis) {
    redis = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    redis.on("error", (err) => {
      console.warn("[redis] Redis client error:", err.message);
    });
  }
  return redis;
}

async function checkRedis() {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return client.ping();
}

module.exports = { redis: getRedisClient(), getRedisClient, checkRedis };
