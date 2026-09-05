import admin from "firebase-admin";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, "../../serviceAccountKey.json");

let fcm = null;

try {
  let serviceAccount = null;

  // 1. Production (Render): build credentials from individual env vars
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Render stores the key with literal \n — convert back to real newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
    console.log("ℹ️ Using Firebase credentials from environment variables");
  }
  // 2. Local dev: fall back to the JSON file on disk
  else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    console.log("ℹ️ Using Firebase credentials from local serviceAccountKey.json");
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    fcm = admin.messaging();
    console.log("✅ Firebase initialized successfully");
  } else {
    console.warn(
      "⚠️ No Firebase credentials found (env vars or serviceAccountKey.json). FCM will be unavailable."
    );
  }
} catch (error) {
  console.warn("⚠️ Failed to initialize Firebase:", error.message);
}

export { fcm };