import { Queue } from 'bullmq';
import redis from '../config/redis.js';

export const notificationQueue = new Queue('notifications', {
  connection: redis,
});