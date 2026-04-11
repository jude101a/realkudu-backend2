import { Worker } from 'bullmq';
import { saveNotification, sendPushNotification } from '../services/notification.service.js';
import { redisConnectionOptions } from "../config/redis.js";

new Worker('notifications', async (job) => {
  const { userId, title, body, data } = job.data;

  try {
    await saveNotification({ userId, title, body, data });
    await sendPushNotification(userId, title, body, data);
    console.log(`✅ Job completed for user: ${userId}`);
  } catch (err) {
    console.error(`❌ Job failed for user: ${userId}`, err);
    throw err; // Let BullMQ retry or log as needed
  }
}, { connection:{
    url: process.env.REDIS_URL,
    ...redisConnectionOptions,
  }, });