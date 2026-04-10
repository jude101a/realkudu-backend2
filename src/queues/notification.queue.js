import { Queue } from "bullmq";
import { redisConnectionOptions } from "../config/redis.js";

export const notificationQueue = new Queue("notifications", {
  connection: redisConnectionOptions,
});