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
    console.debug('[inapp] saveInAppNotification query', { userId, title });
    const start = Date.now();
    const result = await pool.query(query, [userId, title, message, JSON.stringify(meta), false]);
    console.info('[inapp] saveInAppNotification success', { userId, durationMs: Date.now() - start });
    return result.rows[0];
  } catch (error) {
    console.error("[inapp] Error saving in-app notification:", error?.message || error);
    throw error;
  }
}