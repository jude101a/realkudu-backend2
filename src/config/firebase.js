import admin from "firebase-admin";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, "../../serviceAccountKey.json");

let fcm = null;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    fcm = admin.messaging();
    console.log("✅ Firebase initialized successfully");
  } else {
    console.warn("⚠️ serviceAccountKey.json not found. Firebase FCM will be unavailable.");
  }
} catch (error) {
  console.warn("⚠️ Failed to initialize Firebase:", error.message);
}

export { fcm };