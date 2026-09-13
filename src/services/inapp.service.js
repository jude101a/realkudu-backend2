import pool from "../config/db.js";

export async function saveInAppNotification({
  userId,
  title,
  body,
  data = {},
}) {
  try {

    return result.rows[0];
  } catch (error) {
    console.error("[inapp] Error saving in-app notification:", error?.message || error);
    throw error;
  }
}