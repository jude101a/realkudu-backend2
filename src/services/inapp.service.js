import pool from "../config/db.js";

export async function saveInAppNotification({
  userId,
  title,
  message,
  meta = {},
}) {
  try {
    // Insert into notifications table
    const query = `
      INSERT INTO notifications (user_id, title, message, meta, read, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [userId, title, message, JSON.stringify(meta), false]);
    return result.rows[0];
  } catch (error) {
    console.error("Error saving in-app notification:", error);
    throw error;
  }
}