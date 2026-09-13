import { Queue } from "bullmq";

import {
  getRedisConnectionConfig,
} from "../config/redis.js";

const connection = getRedisConnectionConfig();

const defaultJobOptions = {
  attempts: 3,

  backoff: {
    type: "exponential",
    delay: 5000,
  },

  removeOnComplete: {
    age: 60 * 60 * 24,
    count: 1000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 7,
    count: 5000,
  },
};


export const pushQueue = connection
  ? new Queue("push-notifications", {
      connection,
      defaultJobOptions,
    })
  : null;


export const emailQueue = connection
  ? new Queue("email-notifications", {
      connection,
      defaultJobOptions,
    })
  : null;


export const inAppQueue = connection
  ? new Queue("inapp-notifications", {
      connection,
      defaultJobOptions,
    })
  : null;

export const notificationQueue = connection
  ? new Queue("notifications", {
      connection,
      defaultJobOptions,
    })
  : null;

// Backwards-compatible wrapper for modules that expect a simple `.add(name, data, opts)` API
export const notificationQueueWrapper = {
  add: async (name, data = {}, opts = {}) => {
    if (!notificationQueue) {
      console.warn('⚠️ Redis not configured, notificationQueue.add skipped');
      return null;
    }

    // Normalize job payload: worker reads job.name or job.data.type
    const payload = typeof data === 'object' ? data : { payload: data };

    // If caller passed a job object that already contains a `type`, preserve it
    const jobName = name || payload.type || 'UNKNOWN';

    return notificationQueue.add(jobName, payload, opts);
  },
};

export default notificationQueueWrapper;