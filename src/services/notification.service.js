import  pool  from '../config/db.js';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure service account is initialized once
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!admin.apps.length && serviceAccountPath) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed:', error.message);
  }
} else if (!serviceAccountPath) {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH not set, push notifications disabled');
}

export async function saveNotification({ userId, title, body, data }) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, body, data) 
     VALUES ($1, $2, $3, $4)`,
    [userId, title, body, data]
  );
}

export async function sendPushNotification(userId, title, body, data) {
  if (!admin.apps.length) {
    console.warn('⚠️ Firebase not initialized, skipping push notification');
    return;
  }

  const tokens = await getDeviceTokensForUser(userId);
  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    ),
  });
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