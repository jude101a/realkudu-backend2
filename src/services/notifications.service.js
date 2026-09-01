import pool from '../config/db.js';
import * as NotificationModel from '../models/notification.model.js';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import ONE_SIGNAL_CONFIG from "../config/oneSignal.js";
import { sendNotification } from "../services/push.notification.service.js";
import { title } from 'process';

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
  const start = Date.now();
  console.info('[notifications] saveNotification start', { userId, title });
  try {
    await NotificationModel.saveNotification({ userId, title, body, data });
    console.info('[notifications] saveNotification success', { userId, title, durationMs: Date.now() - start });
  } catch (error) {
    console.error('[notifications] saveNotification failed', { userId, title, error: error?.message || error });
    throw error;
  }
}

export async function sendPushNotification(userId, title, body, data) {
  console.info('[notifications] sendPushNotification called', { userId, title });
  if (!admin.apps.length) {
    console.warn('⚠️ Firebase not initialized, skipping push notification for user', userId);
    return;
  }

  const tokens = await getDeviceTokensForUser(userId);
  console.debug('[notifications] sendPushNotification tokens', { userId, tokenCount: tokens.length });
  if (!tokens.length) {
    console.warn('⚠️ No device tokens found for user', userId);
    return;
  }

  try {
    const start = Date.now();
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
    });

    console.info('[notifications] sendPushNotification result', { userId, successCount: response.successCount, failureCount: response.failureCount, durationMs: Date.now() - start });

    if (response.failureCount > 0) {
      console.error('❌ Push send failures', { userId, responses: response.responses });
    }
  } catch (error) {
    console.error('❌ Firebase push send failed for user', userId, error?.message || error);
    throw error;
  }
}

async function getDeviceTokensForUser(userId) {
  console.debug('[notifications] getDeviceTokensForUser query', { userId });
  try {
    const tokens = await NotificationModel.getDeviceTokens(userId);
    console.debug('[notifications] getDeviceTokensForUser result', { userId, tokenCount: tokens.length });
    return tokens;
  } catch (error) {
    console.error('[notifications] getDeviceTokensForUser failed', { userId, error: error?.message || error });
    return [];
  }
}

export const getUserNotifications = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const rows = await NotificationModel.getNotificationsByUser(userId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[notifications.service] getUserNotifications failed', { userId, error: error?.message || error });
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
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
    await NotificationModel.saveOneSignalDeviceToken(userId, token);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error saving device token for user", userId, error);

    return res.status(500).json({
      success: false,
      error: "Failed to save device token",
    });
  }
};



export const getOneSignalDeviceToken = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const token = await NotificationModel.getOneSignalToken(userId);
    return res.json({ success: true, token });
  } catch (error) {
    console.error('❌ Error fetching device token for user', userId, error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to fetch device token' });
  }
};





export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

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

    const userToken = await NotificationModel.getOneSignalToken(userId);

    // Validate OneSignal config
    // if (!ONE_SIGNAL_CONFIG.appId || !ONE_SIGNAL_CONFIG.apiKey) {
    //   console.error('❌ OneSignal configuration missing:', {
    //     appId: !ONE_SIGNAL_CONFIG.appId ? 'NOT SET' : '✓',
    //     apiKey: !ONE_SIGNAL_CONFIG.apiKey ? 'NOT SET' : '✓'
    //   });
    //   return res.status(500).json({
    //     success: false,
    //     error: "OneSignal not configured. Add ONE_SIGNAL_APP_ID and ONE_SIGNAL_API_KEY to Render environment variables.",
    //   });
    // }

    const message = {
  app_id: process.env.ONE_SIGNAL_APP_ID,
  contents: { en: body },
  headings: { en: title },
  
  include_subscription_ids: ["ONESIGNAL_SUBSCRIPTION_ID"],
  data: data || {},
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
//       success: true,
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

 export default {
   saveNotification,
   sendPushNotification,}