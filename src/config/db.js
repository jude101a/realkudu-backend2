import { Pool } from "pg";

const dbSslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
const explicitDbSslSetting = process.env.DB_SSL?.trim().toLowerCase();
const localDbHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const internalHostSuffixes = [".internal", ".render.internal"];
const externalRenderHostSuffix = ".render.com";

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

function getDatabaseHost() {
  return parseDatabaseUrl()?.hostname?.toLowerCase?.() ?? "";
}

function isLocalHost(hostname) {
  return localDbHosts.has(hostname);
}

function isRenderExternalHost(hostname) {
  return hostname.endsWith(externalRenderHostSuffix);
}

function isInternalHost(hostname) {
  return (
    internalHostSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    (process.env.RENDER === "true" &&
      hostname.length > 0 &&
      !hostname.includes(".") &&
      !isLocalHost(hostname))
  );
}

function getConnectionStringForSslMode(sslEnabled) {
  const parsedUrl = parseDatabaseUrl();
  if (!parsedUrl) {
    return getRequiredConnectionString();
  }

  parsedUrl.searchParams.delete("ssl");
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("sslcert");
  parsedUrl.searchParams.delete("sslkey");
  parsedUrl.searchParams.delete("sslrootcert");
  parsedUrl.searchParams.set(
    "sslmode",
    sslEnabled
      ? dbSslRejectUnauthorized
        ? "verify-full"
        : "no-verify"
      : "disable"
  );
  return parsedUrl.toString();
}

function getSslAttemptPlan() {
  const hostname = getDatabaseHost();

  if (explicitDbSslSetting === "true") {
    return [true, false];
  }

  if (explicitDbSslSetting === "false") {
    return [false, true];
  }

  if (isLocalHost(hostname) || isInternalHost(hostname)) {
    return [false, true];
  }

  if (isRenderExternalHost(hostname)) {
    return [true, false];
  }

  return [true, false];
}

function buildPool(sslEnabled) {
  const pool = new Pool({
    connectionString: getConnectionStringForSslMode(sslEnabled),
    ssl: sslEnabled
      ? {
          rejectUnauthorized: dbSslRejectUnauthorized,
        }
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

function shouldTryAlternateSsl(err) {
  const message = err?.message?.toLowerCase?.() ?? "";
  const code = err?.code?.toLowerCase?.() ?? "";

  return (
    code === "28000" ||
    code === "econnreset" ||
    message.includes("ssl/tls required") ||
    message.includes("ssl required") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("the server does not support ssl connections") ||
    message.includes("ssl is not enabled on the server") ||
    message.includes("no pg_hba.conf entry")
  );
}

let currentSslEnabled = getSslAttemptPlan()[0];
let currentPool = buildPool(currentSslEnabled);

export async function ensureDatabaseConnectivity() {
  const attempts = getSslAttemptPlan();
  let lastError = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const sslEnabled = attempts[index];
    const candidatePool =
      index === 0 ? currentPool : buildPool(sslEnabled);

    try {
      await candidatePool.query("SELECT 1");

      if (candidatePool !== currentPool) {
        await currentPool.end().catch(() => {});
        currentPool = candidatePool;
      }

      if (currentSslEnabled !== sslEnabled) {
        console.warn(
          `[DB] Switched startup connection to SSL ${
            sslEnabled ? "enabled" : "disabled"
          } after the initial attempt failed.`
        );
      }

      currentSslEnabled = sslEnabled;
      return;
    } catch (error) {
      lastError = error;

      if (candidatePool !== currentPool) {
        await candidatePool.end().catch(() => {});
      }

      const hasAlternateAttempt = index < attempts.length - 1;
      if (!hasAlternateAttempt || !shouldTryAlternateSsl(error)) {
        throw error;
      }

      continue;
    }
  }

  throw lastError;
}

const pool = {
  query: (...args) => currentPool.query(...args),
  connect: (...args) => currentPool.connect(...args),
  end: (...args) => currentPool.end(...args),
  on: (...args) => currentPool.on(...args),
};

export default pool;
