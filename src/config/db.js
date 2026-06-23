import pg from "pg";
const dbUrl =
  process.env.DATABASE_INTERNAL_URL ||
  process.env.DATABASE_URL;

console.log("DB URL PRESENT:", !!dbUrl);

if (dbUrl) {
  const parsed = new URL(dbUrl);

  console.log("DB HOST:", parsed.hostname);
  console.log("DB DATABASE:", parsed.pathname);
  console.log("DB USER:", parsed.username);
}
const { Pool } = pg;
console.log("***** NEW DB FILE LOADED *****");
const pool = new Pool({
  connectionString:
    process.env.DATABASE_INTERNAL_URL ||
    process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function ensureDatabaseConnectivity() {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT NOW()");
    console.log("DB Connected", result.rows[0]);
  } finally {
    client.release();
  }
}

export default pool;