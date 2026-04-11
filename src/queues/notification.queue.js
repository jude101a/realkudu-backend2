import { Queue } from "bullmq";
import { redisConnectionOptions } from "../config/redis.js";

export const notificationQueue = new Queue("notifications", {
  connection: {
    url: process.env.REDIS_URL,
    ...redisConnectionOptions,
  },
});