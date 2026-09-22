import Redis from "ioredis";

const isProduction = process.env.NODE_ENV === "production";
const redisDisabled = process.env.DISABLE_REDIS === "true";

/**
 * Redis connection options shared by BullMQ / other Redis consumers.
 *
 * Production:
 * - Persistent retries
 *
 * Local:
 * - No automatic reconnect after a failed connection
 */
export const redisConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  retryStrategy: isProduction
    ? (times) => {
        // Production: keep retrying forever.
        return Math.min(times * 1000, 10000);
      }
    : () => {
        // Local: DO NOT reconnect automatically.
        return null;
      },
};

export const getRedisUrl = () => {
  if (redisDisabled) {
    return null;
  }

  if (isProduction) {
    return process.env.REDIS_URL || null;
  }

  return (
    process.env.REDIS_URL_LOCAL ||
    "redis://localhost:6379"
  );
};

export const getRedisConnectionConfig = () => {
  const url = getRedisUrl();

  if (!url) {
    return null;
  }

  return {
    url,
    ...redisConnectionOptions,
  };
};

let redis = null;

const redisUrl = getRedisUrl();

if (redisUrl) {
  redis = new Redis(redisUrl, {
    ...redisConnectionOptions,

    // Don't establish the connection until Redis is actually used.
    lazyConnect: true,

    connectTimeout: 5000,
  });

  redis.on("connect", () => {
    console.log(
      `🔌 Redis connecting... (${isProduction ? "production" : "local"})`
    );
  });

  redis.on("ready", () => {
    console.log("✅ Redis ready");
  });

  redis.on("reconnecting", (delay) => {
    console.warn(
      `🔄 Redis reconnecting in ${delay}ms...`
    );
  });

  redis.on("close", () => {
    console.warn("⚠️ Redis connection closed");
  });

  redis.on("error", (err) => {
    const message = err?.message || String(err);

    if (
      message.includes("ENOTFOUND") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT")
    ) {
      console.warn(
        `⚠️ Redis unavailable: ${message}`
      );

      return;
    }

    console.error("❌ Redis error:", message);
  });
} else {
  console.log(
    `⚠️ Redis disabled (${isProduction ? "production" : "local"}).`
  );
}

export default redis;