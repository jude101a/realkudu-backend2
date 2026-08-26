import Redis from 'ioredis';

// ✅ Connection options (USED BY BullMQ)
export const redisConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  },
};

export const getRedisUrl = () => {
  if (process.env.DISABLE_REDIS === 'true') {
    return null;
  }

  const isLocal = process.env.NODE_ENV !== 'production';

  if (isLocal) {
    return process.env.REDIS_URL_LOCAL || 'redis://localhost:6379';
  }

  return process.env.REDIS_URL || 'redis://localhost:6379';
};

export const getRedisConnectionConfig = () => {
  const url = getRedisUrl();
  if (!url) return null;

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

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    const message = err?.message || String(err);
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      console.warn('⚠️ Redis not available; continuing without Redis for this session.');
      return;
    }
    console.error('❌ Redis error:', message);
  });

  redis.on('ready', () => {
    console.log('✅ Redis ready');
  });
} else {
  console.warn('⚠️ Redis disabled locally (DISABLE_REDIS=true)');
}

export default redis;