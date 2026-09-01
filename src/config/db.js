import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

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

export async function recreatePool({ noSsl = false } = {}) {
  try {
    if (internalPool) {
      try {
        await internalPool.end();
      } catch (e) {
        console.warn("Error ending old internalPool", e?.message || e);
      }
    }
  } finally {
    const opts = {
      connectionString: dbUrl,
    };

    // Prefer explicit CA if provided via env (base64 or file path)
    const caBase64 = process.env.PG_SSL_CA_BASE64;
    const caFile = process.env.PG_SSL_CA_FILE;

    if (!noSsl) {
      if (caBase64) {
        try {
          const ca = Buffer.from(caBase64, 'base64').toString();
          opts.ssl = { rejectUnauthorized: true, ca };
          console.log('Using PG SSL CA from PG_SSL_CA_BASE64');
        } catch (e) {
          console.warn('Failed to parse PG_SSL_CA_BASE64, falling back to rejectUnauthorized:false', e?.message || e);
          opts.ssl = { rejectUnauthorized: false };
        }
      } else if (caFile && fs.existsSync(caFile)) {
        try {
          const ca = fs.readFileSync(caFile, 'utf8');
          opts.ssl = { rejectUnauthorized: true, ca };
          console.log('Using PG SSL CA from PG_SSL_CA_FILE');
        } catch (e) {
          console.warn('Failed to read PG_SSL_CA_FILE, falling back to rejectUnauthorized:false', e?.message || e);
          opts.ssl = { rejectUnauthorized: false };
        }
      } else {
        opts.ssl = { rejectUnauthorized: false };
      }
    } else {
      opts.ssl = false;
    }

    console.log(`Creating new DB pool (noSsl=${noSsl}) ssl=${typeof opts.ssl === 'object' ? JSON.stringify({rejectUnauthorized: opts.ssl.rejectUnauthorized}) : opts.ssl}`);
    internalPool = new Pool(opts);
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
      console.error(`DB connectivity attempt ${attempt} failed:`, err?.message || err);
      // On first failure try recreating the pool with the same SSL options
      if (attempt === 1) {
        try {
          await recreatePool({ noSsl: false });
          console.log("Recreated DB pool (ssl:{rejectUnauthorized:false}), retrying connection");
        } catch (recreateErr) {
          console.error("Failed to recreate DB pool (ssl), will try fallback", recreateErr?.message || recreateErr);
        }
      }
      // On second failure try recreating pool with SSL disabled (some hosts don't accept SSL negotiation from client)
      if (attempt === 2) {
        try {
          await recreatePool({ noSsl: true });
          console.log("Recreated DB pool with SSL disabled (noSsl=true), retrying connection");
        } catch (recreateErr) {
          console.error("Failed to recreate DB pool (noSsl), giving up this round", recreateErr?.message || recreateErr);
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