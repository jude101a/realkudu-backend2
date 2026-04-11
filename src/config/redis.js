import Redis from 'ioredis';


// ✅ Connection options (USED BY BullMQ)
export const redisConnectionOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  },
};
const redis = new Redis(process.env.REDIS_URL, redisConnectionOptions);

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export default redis;