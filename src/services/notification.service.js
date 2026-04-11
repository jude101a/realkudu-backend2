import  pool  from '../config/db.js';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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