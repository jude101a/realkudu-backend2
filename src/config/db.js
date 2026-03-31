import { Pool } from "pg";

const dbSslRejectUnauthorized =
  process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
const explicitDbSslSetting = process.env.DB_SSL?.trim().toLowerCase();
const localDbHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const internalHostSuffixes = [".internal", ".render.internal"];
const externalRenderHostSuffix = ".render.com";
const startupRetryRounds = Number(process.env.DB_STARTUP_RETRY_ROUNDS || 3);
const startupRetryDelayMs = Number(process.env.DB_STARTUP_RETRY_DELAY_MS || 1500);

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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeSslMode(sslEnabled) {
  return sslEnabled ? "enabled" : "disabled";
}

function getStartupDiagnostics() {
  const hostname = getDatabaseHost();
  const plan = getSslAttemptPlan().map(describeSslMode).join(" -> ");

  return {
    host: hostname || "<unknown-host>",
    plan,
    explicitDbSslSetting: explicitDbSslSetting || "<unset>",
  };
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
let currentPool = null;

function getCurrentPool() {
  if (!currentPool) {
    currentPool = buildPool(currentSslEnabled);
  }

  return currentPool;
}

async function tryConnectWithPool(candidatePool, sslEnabled) {
  await candidatePool.query("SELECT 1");

  if (candidatePool !== currentPool) {
    if (currentPool) {
      await currentPool.end().catch(() => {});
    }
    currentPool = candidatePool;
  }

  if (currentSslEnabled !== sslEnabled) {
    console.warn(
      `[DB] Switched startup connection to SSL ${describeSslMode(
        sslEnabled
      )} after the initial attempt failed.`
    );
  }

  currentSslEnabled = sslEnabled;
}

async function trySslMode(sslEnabled, useCurrentPool = false) {
  const candidatePool = useCurrentPool ? getCurrentPool() : buildPool(sslEnabled);

  try {
    await tryConnectWithPool(candidatePool, sslEnabled);
    return null;
  } catch (error) {
    if (candidatePool !== currentPool) {
      await candidatePool.end().catch(() => {});
    }
    return error;
  }
}

export async function ensureDatabaseConnectivity() {
  const attempts = getSslAttemptPlan();
  const diagnostics = getStartupDiagnostics();
  let lastError = null;

  for (let round = 0; round < startupRetryRounds; round += 1) {
    const primarySslEnabled = attempts[0];
    const primaryError = await trySslMode(primarySslEnabled, round === 0);
    if (!primaryError) {
      return;
    }

    lastError = primaryError;
    console.warn(
      `[DB] Startup connection attempt ${round + 1}/${startupRetryRounds} failed ` +
        `(host=${diagnostics.host}, ssl=${describeSslMode(primarySslEnabled)}, code=${
          primaryError.code || "n/a"
        }): ${primaryError.message}`
    );

    if (attempts.length > 1 && shouldTryAlternateSsl(primaryError)) {
      const alternateSslEnabled = attempts[1];
      const alternateError = await trySslMode(alternateSslEnabled);
      if (!alternateError) {
        return;
      }

      lastError = alternateError;
      console.warn(
        `[DB] Alternate SSL attempt ${round + 1}/${startupRetryRounds} failed ` +
          `(host=${diagnostics.host}, ssl=${describeSslMode(
            alternateSslEnabled
          )}, code=${alternateError.code || "n/a"}): ${alternateError.message}`
      );
    }

    if (round < startupRetryRounds - 1) {
      await wait(startupRetryDelayMs * (round + 1));
    }
  }

  throw lastError;
}

const pool = {
  query: (...args) => getCurrentPool().query(...args),
  connect: (...args) => getCurrentPool().connect(...args),
  end: (...args) => getCurrentPool().end(...args),
  on: (...args) => getCurrentPool().on(...args),
};

export default pool;
