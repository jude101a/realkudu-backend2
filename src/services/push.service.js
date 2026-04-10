import admin from "firebase-admin";
import pool from "../config/db.js";

import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export async function sendPushNotification(userId, title, body, data) {
  const tokensResult = await pool.query(
    `SELECT token FROM device_tokens WHERE user_id = $1`,
    [userId]
  );

  const tokens = tokensResult.rows.map((t) => t.token);

  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    ),
  });
}