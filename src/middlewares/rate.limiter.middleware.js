// backend/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

// Defensive Redis setup: skip creating a Redis-backed store when Redis
// is explicitly disabled or when no REDIS_URL is provided. This prevents
// DNS errors or connection failures from crashing the app during tests
// or in environments without Redis.
let redis = null;
let redisStore = null;

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

    // Create RedisStore but do not force an immediate connection. If Redis
    // is unavailable, rate-limit will fall back to the in-memory store when
    // `passOnStoreError` is enabled below.
    redisStore = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    });
  } else {
    console.warn('⚠️ Redis disabled for rate limiter (DISABLE_REDIS or missing REDIS_URL)');
  }
} catch (err) {
  console.warn('⚠️ Failed to initialize Redis for rate limiter:', err?.message || err);
  redis = null;
  redisStore = null;
}

export const dashboardReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: redisStore || undefined,
  passOnStoreError: true,
  keyGenerator: (req) => {
    // Authentication is already enforced. Rate-limit by authenticated user,
    // not only IP, so NAT/shared networks cannot bypass seller limits.
    return `estate-dashboard:${req.user?.id ?? req.ip}`;
  },
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
  store: redisStore || undefined,
  passOnStoreError: true,
  keyGenerator: (req) => {
    return `estate-transaction-write:${req.user?.id ?? req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many transaction update requests.',
  },
});
