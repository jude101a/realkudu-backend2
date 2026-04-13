import { notificationQueue } from "./queue.js";
import { v4 as uuidv4 } from "uuid";

export async function sendNotification({
  user,
  channels = ["PUSH", "EMAIL", "IN_APP"],
  title,
  message,
  data = {},
}) {
  const jobId = uuidv4();

  const jobs = [];
  const tokens = await getDeviceTokensForUser(user.id);

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
  await Promise.all(
    jobs.map((job) =>
      notificationQueue.add(job.type, job, { jobId })
    )
  );

  return { success: true, jobId };
}



async function getDeviceTokensForUser(userId) {
  const result = await pool.query(
    'SELECT token FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  return result.rows.map((row) => row.token);
}

export const getUserNotifications = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const result = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  res.json(result.rows);
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
    await pool.query(
      `
      INSERT INTO device_tokens (user_id, token)
      VALUES ($1, $2)
      ON CONFLICT (token)
      DO UPDATE SET user_id = EXCLUDED.user_id
      `,
      [userId, token]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error saving device token for user", userId, error);

    return res.status(500).json({
      success: false,
      error: "Failed to save device token",
    });
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
    await pool.query(
      `
      INSERT INTO onesignal_device_tokens (user_id, token)
      VALUES ($1, $2)
      ON CONFLICT (token)
      DO UPDATE SET user_id = EXCLUDED.user_id
      `,
      [userId, token]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error saving device token for user", userId, error);

    return res.status(500).json({
      success: false,
      error: "Failed to save device token",
    });
  }
};