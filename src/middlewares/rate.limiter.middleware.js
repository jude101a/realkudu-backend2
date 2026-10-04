// backend/middleware/rateLimiter.js
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

// Defensive Redis setup: skip creating a Redis-backed store when Redis
// is explicitly disabled or when no REDIS_URL is provided. This prevents
// DNS errors or connection failures from crashing the app during tests
// or in environments without Redis.
let redis = null;

const createRedisRateLimitStore = (prefix) => {
  if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL || !redis) {
    return undefined;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args) => redis.call(...args),
  });
};

const getRateLimitKey = (req, prefix) => {
  if (req.user?.id) {
    return `${prefix}:user:${req.user.id}`;
  }

  const ip = req.ip ?? 'unknown';
  return `${prefix}:ip:${ipKeyGenerator(ip)}`;
};

try {
  if (process.env.DISABLE_REDIS !== 'true' && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 100, 2000);
      },
    });
  } else {
    console.warn('⚠️ Redis disabled for rate limiter (DISABLE_REDIS or missing REDIS_URL)');
  }
} catch (err) {
  console.warn('⚠️ Failed to initialize Redis for rate limiter:', err?.message || err);
  redis = null;
}

export const dashboardReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: createRedisRateLimitStore('rl:dashboard'),
  passOnStoreError: true,
  keyGenerator: (req) => getRateLimitKey(req, 'estate-dashboard'),
  message: {
    success: false,
    message: 'Too many dashboard requests. Please try again shortly.',
  },
});

export const transactionWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: createRedisRateLimitStore('rl:transaction-write'),
  passOnStoreError: true,
  keyGenerator: (req) => getRateLimitKey(req, 'estate-transaction-write'),
  message: {
    success: false,
    message: 'Too many transaction update requests.',
  },
});
