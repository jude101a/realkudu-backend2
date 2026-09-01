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

// internalPool holds the real pg Pool instance; we export a proxy so other modules can keep
// using the same `pool` import even if we recreate the underlying Pool on errors.
let internalPool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

function attachPoolHandlers(p) {
  p.on("error", (err) => {
    console.error("Unexpected Postgres client error on idle client", err);
  });
}

attachPoolHandlers(internalPool);

const pool = new Proxy(
  {},
  {
    get(_, prop) {
      const val = internalPool[prop];
      if (typeof val === "function") return val.bind(internalPool);
      return val;
    },
  }
);

export async function recreatePool() {
  try {
    if (internalPool) {
      try {
        await internalPool.end();
      } catch (e) {
        console.warn("Error ending old internalPool", e);
      }
    }
  } finally {
    internalPool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });
    attachPoolHandlers(internalPool);
  }
  return pool;
}

export async function ensureDatabaseConnectivity(retries = 3, delayMs = 500) {
  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      const client = await pool.connect();
      try {
        const result = await client.query("SELECT NOW()");
        console.log("✅ DB Connected", result.rows[0]);
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`DB connectivity attempt ${attempt} failed:`, err.message || err);
      // try to recreate the pool on first failure
      if (attempt === 1) {
        try {
          await recreatePool();
          console.log("Recreated DB pool, retrying connection");
        } catch (recreateErr) {
          console.error("Failed to recreate DB pool", recreateErr);
        }
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
}

export default pool;

// Test helper: allow replacing the internal pool (useful for unit tests)
export function __setInternalPoolForTests(mockPool) {
  internalPool = mockPool;
  attachPoolHandlers(internalPool);
}