import { Worker } from 'bullmq';
import { saveNotification, sendPushNotification } from '../services/notification.service.js';
import { redisConnectionOptions } from "../config/redis.js";

const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { userId, title, body, data } = job.data;

    try {
      console.log(`🔔 Processing notification job ${job.id} for user ${userId}`);
      await saveNotification({ userId, title, body, data });
      await sendPushNotification(userId, title, body, data);
      console.log(`✅ Job completed for user: ${userId}`);
    } catch (err) {
      console.error(`❌ Job failed for user: ${userId}`, err);
      throw err; // Let BullMQ retry or log as needed
    }
  },
  {
    connection: {
      url: process.env.REDIS_URL,
      ...redisConnectionOptions,
    },
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`✅ Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job.id} failed`, err);
});

console.log('✅ Notification worker initialized');