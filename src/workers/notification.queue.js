import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../config/redis.js';

const connection = getRedisConnectionConfig();

export const notificationQueue = connection
  ? new Queue('notifications', { connection })
  : null;

if (!notificationQueue) {
  console.warn('⚠️ Notification queue disabled because Redis is unavailable.');
}
