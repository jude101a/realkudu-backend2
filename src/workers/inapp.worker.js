import { Worker } from "bullmq";

import {
  getRedisConnectionConfig,
} from "../config/redis.js";

import {
  saveInAppNotification,
} from "../services/inapp.service.js";

const connection =
  getRedisConnectionConfig();

let worker = null;


export function startInAppWorker() {
  if (!connection) {
    console.warn(
      "⚠️ In-app worker disabled because Redis is unavailable."
    );

    return null;
  }

  worker = new Worker(
    "inapp-notifications",

    async (job) => {
      console.log(
        `🔔 Processing in-app job ${job.id}`
      );

      await saveInAppNotification(
        job.data
      );

      return {
        success: true,
        channel: "IN_APP",
      };
    },

    {
      connection,

      concurrency: 10,
    }
  );


  worker.on("completed", (job) => {
    console.log(
      `✅ In-app job completed: ${job.id}`
    );
  });


  worker.on("failed", (job, error) => {
    console.error(
      `❌ In-app job failed: ${job?.id}`,
      {
        attempts: job?.attemptsMade,
        error: error.message,
      }
    );
  });


  worker.on("stalled", (jobId) => {
    console.warn(
      `⚠️ In-app job stalled: ${jobId}`
    );
  });


  worker.on("error", (error) => {
    console.error(
      "❌ In-app worker error:",
      error
    );
  });


  console.log(
    "🚀 In-app worker started"
  );

  return worker;
}


export async function stopInAppWorker() {
  if (!worker) return;

  await worker.close();

  worker = null;

  console.log(
    "🛑 In-app worker stopped"
  );
}