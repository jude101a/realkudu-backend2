import pg from "pg";

const { Pool } = pg;

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