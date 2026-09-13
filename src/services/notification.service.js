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
export async function sendNotification({ email,jobName,userName, userId, title, body, channels = ['PUSH'], data = {} }) {
  const jobs = [];
  const emailPayload = { email:email , actionCall: title, userName: userName, reason: body };

try {
   const notification = await saveNotification({ userId, title, body, data });
  

  for (const ch of channels) {
    const upper = String(ch || '').toUpperCase();
    if (upper === 'PUSH') jobs.push(pushQueue.add( {userId, title, body, data, notificationId: notification?.id}));
    else if (upper === 'EMAIL') jobs.push(emailQueue.add(emailPayload));
    else return Promise.reject(new Error(`Unknown notification channel: ${ch}`));
  }

  } catch (err) {
    console.error('[notification.service] sendNotification failed to save notification', { userId, title, error: err?.message || err });
  } 

  return Promise.allSettled(jobs);
}