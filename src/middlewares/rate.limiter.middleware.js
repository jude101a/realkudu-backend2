// backend/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  },
});

const redisStore = new RedisStore({
  sendCommand: (...args) => redis.call(...args),
});

export const dashboardReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: redisStore,
  passOnStoreError: false,
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
  store: redisStore,
  passOnStoreError: false,
  keyGenerator: (req) => {
    return `estate-transaction-write:${req.user?.id ?? req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many transaction update requests.',
  },
});
