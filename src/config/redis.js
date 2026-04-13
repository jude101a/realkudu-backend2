import Redis from 'ioredis';


// ✅ Connection options (USED BY BullMQ)
export const redisConnectionOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  },
};

// Try to connect to Redis, fallback to local if remote fails
let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  ...redisConnectionOptions,
  lazyConnect: true, // Don't connect immediately
  connectTimeout: 5000, // 5 second timeout
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('ready', () => {
  console.log('✅ Redis ready');
});

export default redis;