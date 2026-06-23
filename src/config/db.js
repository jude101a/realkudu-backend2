import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_INTERNAL_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or DATABASE_INTERNAL_URL is required"
  );
}

const isInternal =
  connectionString.includes(".internal") ||
  !connectionString.includes(".render.com");

const pool = new Pool({
  connectionString,

  // Internal Render network -> no SSL
  // External Render URL -> SSL required
  ssl: isInternal
    ? false
    : {
        rejectUnauthorized: false,
      },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

export async function ensureDatabaseConnectivity() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(
      "✅ PostgreSQL connected:",
      result.rows[0].now
    );
  } catch (err) {
    console.error("❌ PostgreSQL connection failed");
    console.error({
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    throw err;
  }
}

export default pool;