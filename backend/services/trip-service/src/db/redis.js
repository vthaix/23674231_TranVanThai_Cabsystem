const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL,
});

async function checkRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis.ping();
}

module.exports = { redis, checkRedis };
