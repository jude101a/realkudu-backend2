import { Pool } from "pg";

const dbSslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
const explicitDbSslSetting = process.env.DB_SSL?.trim().toLowerCase();
const localDbHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function getRequiredConnectionString() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is missing");
    error.code = "MISSING_DATABASE_URL";
    throw error;
  }

  return process.env.DATABASE_URL;
}

function parseDatabaseUrl() {
  try {
    return new URL(getRequiredConnectionString());
  } catch {
    return null;
  }
}

function getConnectionStringWithoutSslMode() {
  const parsedUrl = parseDatabaseUrl();
  if (!parsedUrl) {
    return getRequiredConnectionString();
  }

  parsedUrl.searchParams.delete("sslmode");
  return parsedUrl.toString();
}

function resolveInitialSslEnabled() {
  if (explicitDbSslSetting === "true") return true;
  if (explicitDbSslSetting === "false") return false;

  const parsedUrl = parseDatabaseUrl();
  if (!parsedUrl) {
    return true;
  }

  const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();
  if (sslMode === "disable") return false;
  if (["require", "verify-ca", "verify-full"].includes(sslMode)) {
    return true;
  }

  if (localDbHosts.has(parsedUrl.hostname?.toLowerCase?.() ?? "")) {
    return false;
  }

  return true;
}

function buildPool(sslEnabled) {
  const pool = new Pool({
    connectionString: getConnectionStringWithoutSslMode(),
    ssl: sslEnabled
      ? { rejectUnauthorized: dbSslRejectUnauthorized }
      : false,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(
      process.env.DB_CONNECTION_TIMEOUT_MS || 10000
    ),
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  return pool;
}

function shouldRetryWithAlternateSsl(err) {
  const message = err?.message?.toLowerCase() ?? "";
  const code = err?.code?.toLowerCase?.() ?? "";

  return (
    code === "econnreset" ||
    (code === "28000" && message.includes("ssl")) ||
    message.includes("ssl/tls required") ||
    message.includes("ssl required") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("the server does not support ssl connections") ||
    message.includes("ssl is not enabled on the server") ||
    message.includes("no pg_hba.conf entry")
  );
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
    } catch (retryError) {
      await retryPool.end().catch(() => {});
      throw retryError;
    }
  }
}

const pool = {
  query: (...args) => currentPool.query(...args),
  connect: (...args) => currentPool.connect(...args),
  end: (...args) => currentPool.end(...args),
  on: (...args) => currentPool.on(...args),
};

export default pool;
