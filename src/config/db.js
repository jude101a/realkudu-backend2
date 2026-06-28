import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const dbUrl =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_INTERNAL_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL is not defined.");
}

const parsed = new URL(dbUrl);

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DB HOST:", parsed.hostname);
console.log("DB DATABASE:", parsed.pathname);
console.log("DB USER:", parsed.username);

console.log("***** NEW DB FILE LOADED *****");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function ensureDatabaseConnectivity() {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT NOW()");
    console.log("✅ DB Connected", result.rows[0]);
  } finally {
    client.release();
  }
}

export default pool;