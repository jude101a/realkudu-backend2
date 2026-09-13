import { Worker } from "bullmq";

import {
  getRedisConnectionConfig,
} from "../config/redis.js";

import {
  sendEmail, 
} from "../services/email.service.js";
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountActionEmail } from "../utils/email.js";

const connection =
  getRedisConnectionConfig();

let worker = null;


export function startEmailWorker() {
  if (!connection) {
    console.warn(
      "⚠️ Email worker disabled because Redis is unavailable."
    );

    return null;
  }

  worker = new Worker(
    "email-notifications",

    async (job) => {
  console.log(`📧 Processing email job ${job.id} (${job.name})`);

  switch (job.name) {
    case "sendVerificationEmail": {
      const { email, link } = job.data;
      await sendVerificationEmail(email, link);
      break;
    }

    case "sendPasswordResetRequest": {
      const { email, otp, userName } = job.data;
      await sendPasswordResetEmail(email, otp, userName);
      break;
    }
    case "sendPasswordResetResponse": {
      
    }

    case "sendAccountActionEmail": {
      const { actionCall, userName, reason, actionLink, deadline } = job.data;
      await sendAccountActionEmail({ actionCall, userName, reason, actionLink, deadline });
      break;
    }

    // add more cases as you introduce new email job types

    default:
      throw new Error(`Unknown email job type: ${job.name}`);
  }

  return {
    success: true,
    channel: "EMAIL",
    jobName: job.name,
  };
},

    {
      connection,

      concurrency: 5,

      limiter: {
        max: 50,
        duration: 1000,
      },
    }
  );


  worker.on("completed", (job) => {
    console.log(
      `✅ Email job completed: ${job.id}`
    );
  });


  worker.on("failed", (job, error) => {
    console.error(
      `❌ Email job failed: ${job?.id}`,
      {
        attempts: job?.attemptsMade,
        error: error.message,
      }
    );
  });


  worker.on("stalled", (jobId) => {
    console.warn(
      `⚠️ Email job stalled: ${jobId}`
    );
  });


  worker.on("error", (error) => {
    console.error(
      "❌ Email worker error:",
      error
    );
  });


  console.log(
    "🚀 Email worker started"
  );

  return worker;
}


export async function stopEmailWorker() {
  if (!worker) return;

  await worker.close();

  worker = null;

  console.log(
    "🛑 Email worker stopped"
  );
}