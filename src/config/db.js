import { Pool } from "pg";

/**
 * ✅ Validate environment
 */
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
  process.exit(1);
}

/**
 * 🔒 Force SSL (Render requirement)
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },

  // ⚡ optional tuning
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * 🧪 Test connection on startup
 */
export async function ensureDatabaseConnectivity() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  }
}

/**
 * 📦 Export pool
 */
export default pool;