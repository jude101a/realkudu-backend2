import pool from '../config/db.js';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import ONE_SIGNAL_CONFIG from "../config/oneSignal.js";
import { sendNotification } from "../services/push.notification.service.js";

// Ensure service account is initialized once
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const localServiceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (!admin.apps.length) {
    let serviceAccount = null;

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } else if (fs.existsSync(localServiceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'));
    }

    if (serviceAccount) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log('✅ Firebase initialized');
      } catch (error) {
        console.warn('⚠️ Firebase initialization failed:', error.message);
      }
    } else {
      console.warn(
        '⚠️ Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT_PATH or provide serviceAccountKey.json in the project root.'
      );
    }
  }
};

initializeFirebase();

export async function saveNotification({ userId, title, body, data }) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, body, data) 
     VALUES ($1, $2, $3, $4)`,
    [userId, title, body, data]
  );
}

export async function sendPushNotification(userId, title, body, data) {
  if (!admin.apps.length) {
    console.warn('⚠️ Firebase not initialized, skipping push notification for user', userId);
    return;
  }

  const tokens = await getDeviceTokensForUser(userId);
  if (!tokens.length) {
    console.warn('⚠️ No device tokens found for user', userId);
    return;
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
    });

    console.log(
      `✅ Push notification sent for user ${userId}: ${response.successCount}/${response.failureCount} success`
    );

    if (response.failureCount > 0) {
      console.error('❌ Push send failures', response.responses);
    }
  } catch (error) {
    console.error('❌ Firebase push send failed for user', userId, error);
    throw error;
  }
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

export const sendNotificationToAll = async (req, res) => {
  try {
    const { title, body, data, priority, icon } = req.body;

    // Validate required fields
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Title and body are required",
      });
    }

    // Validate OneSignal config
    if (!ONE_SIGNAL_CONFIG.appId || !ONE_SIGNAL_CONFIG.apiKey) {
      console.error('❌ OneSignal configuration missing:', {
        appId: !ONE_SIGNAL_CONFIG.appId ? 'NOT SET' : '✓',
        apiKey: !ONE_SIGNAL_CONFIG.apiKey ? 'NOT SET' : '✓'
      });
      return res.status(500).json({
        success: false,
        error: "OneSignal not configured. Add ONE_SIGNAL_APP_ID and ONE_SIGNAL_API_KEY to Render environment variables.",
      });
    }

    const message = {
      app_id: ONE_SIGNAL_CONFIG.appId,
      contents: { en: body },
      headings: { en: title },
      included_segments: ["All"],
      content_available: true,
      data: data || {},
      small_icon: icon || "ic_notification",
    };

    // Set a reasonable timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    const callbackPromise = new Promise((resolve, reject) => {
      sendNotification(message, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });

    const response = await Promise.race([callbackPromise, timeoutPromise]);
    
    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: response,
    });
  } catch (error) {
    console.error('❌ Error in sendNotificationToAll:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to send notification",
    });
  }
};

export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, body, data, priority, icon } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Title and body are required",
      });
    }

    // Validate OneSignal config
    if (!ONE_SIGNAL_CONFIG.appId || !ONE_SIGNAL_CONFIG.apiKey) {
      console.error('❌ OneSignal configuration missing:', {
        appId: !ONE_SIGNAL_CONFIG.appId ? 'NOT SET' : '✓',
        apiKey: !ONE_SIGNAL_CONFIG.apiKey ? 'NOT SET' : '✓'
      });
      return res.status(500).json({
        success: false,
        error: "OneSignal not configured. Add ONE_SIGNAL_APP_ID and ONE_SIGNAL_API_KEY to Render environment variables.",
      });
    }

    const message = {
      app_id: ONE_SIGNAL_CONFIG.appId,
      contents: { en: body },
      headings: { en: title },
      included_segments: ["included_player_ids"],
      included_player_ids: [String(userId)],
      content_available: true,
      data: data || {},
      small_icon: icon || "ic_notification",
    };

    // Set a reasonable timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    const callbackPromise = new Promise((resolve, reject) => {
      sendNotification(message, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });

    const response = await Promise.race([callbackPromise, timeoutPromise]);
    
    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: response,
    });
  } catch (error) {
    console.error('❌ Error in sendNotificationToUser:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to send notification",
    });
  }
};