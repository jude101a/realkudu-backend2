import { notificationQueue } from "../workers/notification.queue.js";
import { v4 as uuidv4 } from "uuid";
import * as NotificationModel from "../models/notification.model.js";

export async function sendNotification({
  user,
  channels = ["PUSH", "EMAIL", "IN_APP"],
  title,
  message,
  data = {},
}) {
  const jobId = uuidv4();

  const jobs = [];
  console.info('[notifications] sendNotification called', { userId: user?.id, channels, title });
  const tokens = await NotificationModel.getDeviceTokens(user.id);
  console.debug('[notifications] device tokens fetched', { userId: user?.id, tokenCount: tokens.length });

  if (channels.includes("PUSH") && tokens.length > 0) {
    jobs.push({
      type: "PUSH",
      payload: {
        tokens,
        title,
        body: message,
        data,
      },
    });
  }

  if (channels.includes("EMAIL") && user.email) {
    jobs.push({
      type: "EMAIL",
      payload: {
        to: user.email,
        subject: title,
        html: `<p>${message}</p>`,
      },
    });
  }

  if (channels.includes("IN_APP")) {
    jobs.push({
      type: "IN_APP",
      payload: {
        userId: user.id,
        title,
        message,
        meta: data,
      },
    });
  }

  // Bulk enqueue
  if (notificationQueue) {
    await Promise.all(
      jobs.map((job) =>
        notificationQueue.add(job.type, job, { jobId }).catch((err) => {
          console.warn("⚠️ enqueue failed", job.type, { jobId, error: err?.message || err });
        })
      )
    );
  } else {
    console.warn("⚠️ notificationQueue unavailable — skipping enqueue", { jobTypes: jobs.map((j) => j.type), jobId });
  }

  return { success: true, jobId };
}



// Device/token and notification persistence are handled by the model in src/models/notification.model.js


export const getUserNotifications = async (req, res) => {
  // Support multiple caller patterns:
  // - authenticated routes that set req.user.id
  // - routes that pass a userId in params (userId or id)
  const userId = req.user?.id || req.params.userId || req.params.id;

  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  try {
    const rows = await NotificationModel.getNotificationsByUser(userId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error fetching notifications for user", userId, error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
};

export const saveDeviceToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!token) {
    return res.status(400).json({
      success: false,
      error: "Token is required",
    });
  }

  try {
    await NotificationModel.saveDeviceToken(userId, token);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error saving device token for user", userId, error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to save device token" });
  }
};

export const saveOneSignalDeviceToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!token) {
    return res.status(400).json({
      success: false,
      error: "Token is required",
    });
  }

  try {
    await NotificationModel.saveOneSignalDeviceToken(userId, token);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error saving device token for user", userId, error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to save device token" });
  }
};