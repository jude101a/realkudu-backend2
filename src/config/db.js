// import { Pool } from "pg";

// const dbSslRejectUnauthorized =
//   process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
// const explicitDbSslSetting = process.env.DB_SSL?.trim().toLowerCase();

// function getConnectionStringWithoutSslMode() {
//   try {
//     const url = new URL(process.env.DATABASE_URL ?? "");
//     url.searchParams.delete("sslmode");
//     return url.toString();
//   } catch {
//     return process.env.DATABASE_URL;
//   }
// }

// function resolveInitialSslEnabled() {
//   if (explicitDbSslSetting === "true") return true;
//   if (explicitDbSslSetting === "false") return false;

//   try {
//     const url = new URL(process.env.DATABASE_URL ?? "");
//     const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

//     if (sslMode === "disable") return false;
//     if (["require", "verify-ca", "verify-full"].includes(sslMode)) {
//       return true;
//     }
//   } catch {
//     // Fall back to the previous default when the URL is unavailable or invalid.
//   }

//   return true;
// }

// function buildPool(sslEnabled) {
//   const pool = new Pool({
//     connectionString: getConnectionStringWithoutSslMode(),
//     ssl: sslEnabled
//       ? { rejectUnauthorized: dbSslRejectUnauthorized }
//       : false,
//   });

//   pool.on("error", (err) => {
//     console.error("Unexpected PG pool error:", err);
//   });

//   return pool;
// }

// function shouldRetryWithAlternateSsl(err) {
//   const message = err?.message?.toLowerCase() ?? "";
//   const code = err?.code?.toLowerCase?.() ?? "";

//   return (
//     message.includes("ssl/tls required") ||
//     message.includes("ssl required") ||
//     message.includes("connection terminated unexpectedly") ||
//     message.includes("the server does not support ssl connections") ||
//     message.includes("ssl is not enabled on the server") ||
//     message.includes("no pg_hba.conf entry") ||
//     (code === "28000" && message.includes("ssl"))
//   );
// }

// let currentSslEnabled = resolveInitialSslEnabled();
// let currentPool = buildPool(currentSslEnabled);

// export async function ensureDatabaseConnectivity() {
//   try {
//     await currentPool.query("SELECT 1");
//     return;
//   } catch (initialError) {
//     if (!shouldRetryWithAlternateSsl(initialError)) {
//       throw initialError;
//     }

//     const retrySslEnabled = !currentSslEnabled;
//     const retryPool = buildPool(retrySslEnabled);

//     try {
//       await retryPool.query("SELECT 1");
//       await currentPool.end().catch(() => {});
//       currentPool = retryPool;
//       currentSslEnabled = retrySslEnabled;
//       console.warn(
//         `[DB] Retried startup connection with SSL ${
//           retrySslEnabled ? "enabled" : "disabled"
//         } after startup rejected the initial SSL mode${
//           explicitDbSslSetting ? ` (DB_SSL=${explicitDbSslSetting})` : ""
//         }.`
//       );
//       return;
//     } catch (retryError) {
//       await retryPool.end().catch(() => {});
//       throw retryError;
//     }
//   }
// }

// const pool = {
//   query: (...args) => currentPool.query(...args),
//   connect: (...args) => currentPool.connect(...args),
//   end: (...args) => currentPool.end(...args),
//   on: (...args) => currentPool.on(...args),
// };

// export default pool;


// db.js
import pkg from "pg";

const { Pool } = pkg;

/**
 * 🔒 Validate required environment variables
 */
function validateEnv() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is missing in environment variables");
    process.exit(1);
  }
}

/**
 * 🏗️ Create PostgreSQL connection pool
 */
function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,

    // 🔥 REQUIRED for Render PostgreSQL
    ssl: {
      rejectUnauthorized: false,
    },

    // ⚡ Pool tuning (important for performance)
    max: 10, // max connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

validateEnv();

const pool = createPool();

/**
 * 🔁 Retry connection logic (prevents crash on startup)
 */
export async function connectDB(retries = 5, delay = 5000) {
  while (retries) {
    try {
      const client = await pool.connect();
      console.log("✅ Database connected successfully");

      // release immediately (pool keeps connection)
      client.release();
      return;

    } catch (err) {
      console.error(`❌ DB connection failed: ${err.message}`);

      retries -= 1;

      if (!retries) {
        console.error("❌ Exhausted all retries. Exiting...");
        process.exit(1);
      }

      console.log(`🔁 Retrying in ${delay / 1000}s... (${retries} attempts left)`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * 🧪 Query helper (clean abstraction)
 */
export async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error("❌ Query error:", err.message);
    throw err;
  }
}

/**
 * 🩺 Health check (for /health endpoint)
 */
export async function checkDBHealth() {
  try {
    await pool.query("SELECT 1");
    return { status: "healthy" };
  } catch (err) {
    return { status: "unhealthy", error: err.message };
  }
}

/**
 * 🧹 Graceful shutdown
 */
export async function closeDB() {
  try {
    await pool.end();
    console.log("🛑 Database pool closed");
  } catch (err) {
    console.error("❌ Error closing DB:", err.message);
  }
}