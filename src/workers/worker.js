import { Worker } from "bullmq";
import redis from "../config/redis.js";
import { sendPush } from "../services/push.notification.service.js";
import { sendEmail } from "../services/email.service.js";
import { saveInAppNotification } from "../services/inapp.service.js";

let worker = null;

async function startWorker() {
  try {
    const connection = redis;

    // Test Redis connection with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout - no Redis server available'));
      }, 5000);

      const onReady = () => {
        clearTimeout(timeout);
        connection.off('ready', onReady);
        connection.off('error', onError);
        resolve();
      };

      const onError = (err) => {
        clearTimeout(timeout);
        connection.off('ready', onReady);
        connection.off('error', onError);
        reject(err);
      };

      connection.on('ready', onReady);
      connection.on('error', onError);

      // Try to connect if not already connected
      if (!connection.status || connection.status === 'close') {
        connection.connect().catch(onError);
      } else if (connection.status === 'ready') {
        onReady();
      }
    });

    worker = new Worker(
      "notifications",
      async (job) => {
        const { type, payload } = job.data;

        switch (type) {
          case "PUSH":
            return await sendPush(payload);

          case "EMAIL":
            return await sendEmail(payload);

          case "IN_APP":
            return await saveInAppNotification(payload);

          case "ALL":
            // Run in parallel for efficiency
            return await Promise.allSettled([
              sendPush(payload.push),
              sendEmail(payload.email),
              saveInAppNotification(payload.inApp),
            ]);

          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
      },
      {
        connection,
        concurrency: 5, // Process up to 5 jobs simultaneously
      }
    );

    worker.on('ready', () => {
      console.log('✅ Notification worker is ready');
    });

    worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });

    console.log('✅ Notification worker started successfully');
  } catch (error) {
    console.error('❌ Failed to start notification worker:', error.message);
    console.log('ℹ️  To enable background notifications:');
    console.log('   1. Install Redis locally: https://redis.io/download');
    console.log('   2. Or update REDIS_URL in .env to a valid Redis instance');
    console.log('   3. Restart the worker');
    console.log('🔄 Worker will check for Redis every 30 seconds...');

    // Retry every 30 seconds
    setTimeout(startWorker, 30000);
  }
}

startWorker();