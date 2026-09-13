import Redis from "ioredis";

export const redisConnectionOptions = {
  maxRetriesPerRequest: null,

  enableReadyCheck: true,

  retryStrategy: (times) => {
    return Math.min(times * 500, 5000);
  },
};

export const getRedisUrl = () => {
  if (process.env.DISABLE_REDIS === "true") {
    return null;
  }

  const isProduction =
    process.env.NODE_ENV === "production";

  if (!isProduction) {
    return (
      process.env.REDIS_URL_LOCAL ||
      "redis://localhost:6379"
    );
  }

  return process.env.REDIS_URL || null;
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
    lazyConnect: true,
    connectTimeout: 5000,
  });

  redis.on("connect", () => {
    console.log("🔌 Redis connecting...");
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
    const message =
      err?.message || String(err);

    if (
      message.includes("ENOTFOUND") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT")
    ) {
      console.warn(
        `⚠️ Redis temporarily unavailable: ${message}`
      );

      return;
    }

    console.error(
      "❌ Redis error:",
      message
    );
  });
} else {
  console.warn("⚠️ Redis disabled.");
}

export default redis;