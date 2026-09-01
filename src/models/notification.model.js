import pool from "../config/db.js";

const NOTIFICATIONS_TABLE = "notifications";
const DEVICE_TOKENS_TABLE = "device_tokens";
const ONESIGNAL_TABLE = "onesignal_device_tokens";

export async function getNotificationsByUser(userId, { limit = 100, offset = 0 } = {}) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${NOTIFICATIONS_TABLE} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows || [];
  } catch (err) {
    console.error('[notification.model] getNotificationsByUser failed', { userId, error: err?.message || err });
    // Rethrow so callers can decide how to surface the error (HTTP 500 vs empty result)
    throw err;
  }
}

export async function getDeviceTokens(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT token FROM ${DEVICE_TOKENS_TABLE} WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => r.token).filter(Boolean);
  } catch (err) {
    console.error('[notification.model] getDeviceTokens failed', { userId, error: err?.message || err });
    return [];
  }
}

export async function saveDeviceToken(userId, token) {
  try {
    await pool.query(
      `INSERT INTO ${DEVICE_TOKENS_TABLE} (user_id, token) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [userId, token]
    );
    return true;
  } catch (err) {
    console.error('[notification.model] saveDeviceToken failed', { userId, token, error: err?.message || err });
    throw err;
  }
}

export async function saveOneSignalDeviceToken(userId, token) {
  try {
    await pool.query(
      `INSERT INTO ${ONESIGNAL_TABLE} (user_id, token) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [userId, token]
    );
    return true;
  } catch (err) {
    console.error('[notification.model] saveOneSignalDeviceToken failed', { userId, token, error: err?.message || err });
    throw err;
  }
}

export async function getOneSignalToken(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT token FROM ${ONESIGNAL_TABLE} WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0]?.token || null;
  } catch (err) {
    console.error('[notification.model] getOneSignalToken failed', { userId, error: err?.message || err });
    return null;
  }
}

export async function saveNotification({ userId, title, body, data = {} }) {
  try {
    await pool.query(
      `INSERT INTO ${NOTIFICATIONS_TABLE} (user_id, title, body, data) VALUES ($1, $2, $3, $4)`,
      [userId, title, body, data]
    );
    return true;
  } catch (err) {
    console.error('[notification.model] saveNotification failed', { userId, title, error: err?.message || err });
    throw err;
  }
}

export default {
  getNotificationsByUser,
  getDeviceTokens,
  saveDeviceToken,
  saveOneSignalDeviceToken,
  getOneSignalToken,
  saveNotification,
};
