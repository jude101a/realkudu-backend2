import pool from "../config/db.js";

export async function saveNotification({ userId, title, body, data }) {
  await pool.query(
    `
    INSERT INTO notifications (user_id, title, body, data)
    VALUES ($1, $2, $3, $4)
    `,
    [userId, title, body, data]
  );
}


export const getUserNotifications = async (req, res) => {
  const userId = req.userId;

  const result = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  res.json(result.rows);
};

export const saveDeviceToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  await pool.query(
    `INSERT INTO device_tokens (user_id, token) VALUES ($1, $2)`,
    [userId, token]
  );

  res.json({ success: true });
};