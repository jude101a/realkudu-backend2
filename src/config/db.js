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
// SSL should be enabled by default; only disable if PG explicitly requires it (not recommended).
// Historically DB_SSL could disable SSL; to keep connections secure we'll default to SSL on.
let defaultNoSsl = false;
if (typeof process.env.DB_SSL !== 'undefined') {
  console.warn('DB_SSL environment variable detected — SSL will remain enabled by default to ensure secure DB connections.');
}

let internalPool = (() => {
  const opts = { connectionString: dbUrl };
  if (defaultNoSsl) {
    opts.ssl = false;
    console.log('DB SSL disabled via DB_SSL=false');
  } else {
    opts.ssl = { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() !== 'false' ? true : false };
  }
  return new Pool(opts);
})();

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
      // Special-case `query` to add a single automatic retry+recreate on transient connection failures
      if (prop === "query") {
        return async function queryWithRetry(text, params) {
          try {
            return await internalPool.query(text, params);
          } catch (err) {
            const msg = String(err?.message || "").toLowerCase();
            const isTransient = msg.includes("connection terminated unexpectedly") || msg.includes("ecoff") || err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED";
            if (isTransient) {
              console.warn('[db] transient query error, attempting pool recreate then retry', { message: err?.message || err });
              try {
                await recreatePool();
                return await internalPool.query(text, params);
              } catch (retryErr) {
                console.error('[db] retry after recreate failed', { error: retryErr?.message || retryErr });
                throw retryErr;
              }
            }
            throw err;
          }
        };
      }

      const val = internalPool[prop];
      if (typeof val === "function") return val.bind(internalPool);
      return val;
    },
  }
);

export async function recreatePool({ noSsl = undefined } = {}) {
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

    // Decide ssl mode: if noSsl explicitly true use false; else if undefined use defaultNoSsl; else use provided value
    const finalNoSsl = typeof noSsl === 'boolean' ? noSsl : defaultNoSsl;
    if (!finalNoSsl) {
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

    console.log(`Creating new DB pool (noSsl=${finalNoSsl}) ssl=${typeof opts.ssl === 'object' ? JSON.stringify({rejectUnauthorized: opts.ssl.rejectUnauthorized}) : opts.ssl}`);
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
      // Only attempt non-SSL fallback if DB_SSL was explicitly set to false
      if (attempt === 2 && defaultNoSsl) {
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