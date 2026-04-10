import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { sendPushNotification } from "../services/push.service.js";
import { saveNotification } from "../services/notification.service.js";

new Worker(
  "notifications",
  async (job) => {
    const { userId, title, body, data } = job.data;

    // 1. Save to DB (in-app notification)
    await saveNotification({
      userId,
      title,
      body,
      data,
    });

    // 2. Send Push Notification
    await sendPushNotification(userId, title, body, data);
  },
  { connection: redis }
);