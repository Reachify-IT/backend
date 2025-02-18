const { Queue } = require("bullmq");
const Redis = require("ioredis");

require("dotenv").config();

// Ensure REDIS_URL is used correctly
const redisConnection = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false }, // Required for Upstash
});

// Create BullMQ queue
const videoQueue = new Queue("videoProcessing", { connection: redisConnection });

// Handle Redis connection errors
redisConnection.on("error", (err) => {
  console.error("Redis connection error ❌:", err);
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected!");
});

module.exports = { videoQueue, redisConnection };
