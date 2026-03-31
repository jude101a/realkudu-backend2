import { Pool } from "pg";

const dbSslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
const explicitDbSslSetting = process.env.DB_SSL?.trim().toLowerCase();

function getConnectionStringWithoutSslMode() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return process.env.DATABASE_URL;
  }
}

function resolveInitialSslEnabled() {
  if (explicitDbSslSetting === "true") return true;
  if (explicitDbSslSetting === "false") return false;

  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode === "disable") return false;
    if (["require", "verify-ca", "verify-full"].includes(sslMode)) {
      return true;
    }
  } catch {
    // Fall back to the previous default when the URL is unavailable or invalid.
  }

  return true;
}

function buildPool(sslEnabled) {
  const pool = new Pool({
    connectionString: getConnectionStringWithoutSslMode(),
    ssl: sslEnabled
      ? { rejectUnauthorized: dbSslRejectUnauthorized }
      : false,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  return pool;
}

let currentSslEnabled = resolveInitialSslEnabled();
let currentPool = buildPool(currentSslEnabled);

export async function ensureDatabaseConnectivity() {
  try {
    await currentPool.query("SELECT 1");
    return;
  } catch (initialError) {
    if (!shouldRetryWithAlternateSsl(initialError)) {
      throw initialError;
    }

    const retrySslEnabled = !currentSslEnabled;
    const retryPool = buildPool(retrySslEnabled);

    try {
      await retryPool.query("SELECT 1");
      await currentPool.end().catch(() => {});
      currentPool = retryPool;
      currentSslEnabled = retrySslEnabled;
      console.warn(
        `[DB] Retried startup connection with SSL ${
          retrySslEnabled ? "enabled" : "disabled"
        } after startup rejected the initial SSL mode${
          explicitDbSslSetting ? ` (DB_SSL=${explicitDbSslSetting})` : ""
        }.`
      );
      return;
    } catch (retryError) {
      await retryPool.end().catch(() => {});
      throw retryError;
    }
  }
}

function shouldRetryWithAlternateSsl(error) {
  if (explicitDbSslSetting === "true" || explicitDbSslSetting === "false") {
    return false;
  }

  const message =
    typeof error?.message === "string"
      ? error.message.toLowerCase()
      : String(error ?? "").toLowerCase();

  const retryTriggers = [
    "ssl",
    "tls",
    "certificate",
    "self signed",
    "server does not support ssl",
    "ssl connection is required",
    "unsupported frontend protocol",
    "connection terminated unexpectedly",
    "unexpected message",
    "tls handshake",
    "certificate verify failed",
    "server certificate verification failed",
    "sslmode",
    "ssl handshake",
  ];

  return retryTriggers.some((trigger) => message.includes(trigger));
}



const pool = {
  query: (...args) => currentPool.query(...args),
  connect: (...args) => currentPool.connect(...args),
  end: (...args) => currentPool.end(...args),
  on: (...args) => currentPool.on(...args),
};

export default pool;
