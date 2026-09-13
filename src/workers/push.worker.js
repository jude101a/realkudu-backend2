import { Worker } from "bullmq";

import {
  getRedisConnectionConfig,
} from "../config/redis.js";

import {
  sendPush,
} from "../services/push.notification.service.js";

const connection =
  getRedisConnectionConfig();

let worker = null;


export function startPushWorker() {
  if (!connection) {
    console.warn(
      "⚠️ Push worker disabled because Redis is unavailable."
    );

    return null;
  }

  worker = new Worker(
    "push-notifications",

    async (job) => {
      console.log(
        `📱 Processing push job ${job.id}`
      );

      await sendPush(job.data);

      return {
        success: true,
        channel: "PUSH",
      };
    },

    {
      connection,
      concurrency: 10,

      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );


  worker.on("completed", (job) => {
    console.log(
      `✅ Push job completed: ${job.id}`
    );
  });


  worker.on("failed", (job, error) => {
    console.error(
      `❌ Push job failed: ${job?.id}`,
      {
        attempts: job?.attemptsMade,
        error: error.message,
      }
    );
  });


  worker.on("stalled", (jobId) => {
    console.warn(
      `⚠️ Push job stalled: ${jobId}`
    );
  });


  worker.on("error", (error) => {
    console.error(
      "❌ Push worker error:",
      error
    );
  });


  console.log(
    "🚀 Push worker started"
  );

  return worker;
}


export async function stopPushWorker() {
  if (!worker) return;

  await worker.close();

  worker = null;

  console.log(
    "🛑 Push worker stopped"
  );
}