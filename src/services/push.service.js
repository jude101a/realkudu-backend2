import admin from "firebase-admin";
import * as NotificationModel from "../models/notification.model.js";

import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export async function sendPushNotification(userId, title, body, data) {
  const tokens = await NotificationModel.getDeviceTokens(userId);

  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    ),
  });
}