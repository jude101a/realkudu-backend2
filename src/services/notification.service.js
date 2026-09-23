export async function queueNotificationEvent({
  event,
  entityId,
  push,
  email,
  inApp,
}) {
  const jobs = [];

  if (push) {
    jobs.push(
      queuePushNotification({
        event,
        entityId,
        payload: push,
      })
    );
  }

  if (email) {
    jobs.push(
      queueEmailNotification({
        event,
        entityId,
        payload: email,
      })
    );
  }

  if (inApp) {
    jobs.push(
      queueInAppNotification({
        event,
        entityId,
        payload: inApp,
      })
    );
  }

  return Promise.all(jobs);
}

import { pushQueue, emailQueue } from '../queues/notification.queue.js';
import {saveNotification} from '../models/notification.model.js';


// Controller-friendly API used across the app
export async function sendNotification({
  email,
  jobName,
  userName,
  userId,
  title,
  body,
  channels = ["PUSH"],
  data = {},
}) {
  const jobs = [];

  const emailPayload = {
    email,
    actionCall: title,
    userName,
    reason: body,
  };

  try {
    // 1. Save notification to database
    const notification = await saveNotification({
      userId,
      title,
      body,
      data,
    });

    // 2. Process requested channels
    for (const ch of channels) {
      const upper = String(ch || "").toUpperCase();

      // -------------------------
      // PUSH
      // -------------------------
      if (upper === "PUSH") {
        if (!pushQueue) {
          console.warn(
            "[notification.service] PUSH skipped: pushQueue is unavailable (Redis disabled)"
          );
          continue;
        }

        jobs.push(
          pushQueue.add("send-push-notification", {
            userId,
            title,
            body,
            data,
            notificationId: notification?.id,
          })
        );
      }

      // -------------------------
      // EMAIL
      // -------------------------
      else if (upper === "EMAIL") {
        if (!emailQueue) {
          console.warn(
            "[notification.service] EMAIL skipped: emailQueue is unavailable"
          );
          continue;
        }

        jobs.push(
          emailQueue.add("send-email-notification", emailPayload)
        );
      }

      // -------------------------
      // UNKNOWN CHANNEL
      // -------------------------
      else {
        console.warn(
          `[notification.service] Unknown notification channel: ${ch}`
        );
      }
    }
  } catch (err) {
    console.error(
      "[notification.service] sendNotification failed",
      {
        userId,
        title,
        error: err?.message || err,
      }
    );
  }

  return Promise.allSettled(jobs);
}