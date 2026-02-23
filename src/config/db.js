import { Pool } from "pg";

const dbSslDisabled = process.env.DB_SSL === "false";
const dbSslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: dbSslDisabled
    ? false
    : { rejectUnauthorized: dbSslRejectUnauthorized },
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

export default pool;
