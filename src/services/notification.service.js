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


export function normalizeNotificationInput(input = {}) {
  const userId = input.userId ?? input.user?.id ?? null;
  const body = input.body ?? input.message ?? "";
  const title = input.title ?? "";
  const channels = Array.isArray(input.channels) && input.channels.length
    ? input.channels
    : ["PUSH"];

  return {
    ...input,
    userId,
    body,
    title,
    channels,
  };
}

// Controller-friendly API used across the app
export async function sendNotification(input = {}) {
  const normalized = normalizeNotificationInput(input);
  const {
    email,
    jobName,
    userName,
    userId,
    title,
    body,
    channels,
    data = {},
  } = normalized;

  const jobs = [];

  if (!userId) {
    console.warn("[notification.service] Ignored notification without userId", {
      title,
      body,
      input,
    });
    return [];
  }

  const emailPayload = {
    email,
    actionCall: title,
    userName,
    reason: body,
  };

  try {
    const notification = await saveNotification({
      userId,
      title,
      body,
      data,
    });

    for (const ch of channels) {
      const upper = String(ch || "").toUpperCase();

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