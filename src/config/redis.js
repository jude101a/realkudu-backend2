import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS;

const redisConnection = redisUrl
  ? { url: redisUrl }
  : {
      host: "127.0.0.1",
      port: 6379,
    };

export const redis = new Redis(redisConnection);
export const redisConnectionOptions = redisConnection;

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (error) => {
  console.error("❌ Redis error", error);
});