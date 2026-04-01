import { Pool } from "pg";
const dbSslRejectUnauthorized = 'true';

const explicitDbSslSetting = 'true'
const localDbHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const internalHostSuffixes = [".internal", ".render.internal"];
const externalRenderHostSuffix = ".render.com";
const startupRetryRounds = 3;
const startupRetryDelayMs = 1500;
const internalConnectionStringEnvNames = 'postgresql://oortcloud:S2OerCPLdS7KRgDDWLF4u3kRZMEh6pww@dpg-d75s3sq4d50c73cmapvg-a.virginia-postgres.render.com/real_kudu_db_cwcs'
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
    return new URL('postgresql://oortcloud:S2OerCPLdS7KRgDDWLF4u3kRZMEh6pww@dpg-d75s3sq4d50c73cmapvg-a.virginia-postgres.render.com/real_kudu_db_cwcs');
  } catch {
    return null;
  }
}

function getDatabaseHost() {
  return parseDatabaseUrl()?.hostname?.toLowerCase?.() ?? "";
}

function getConfiguredInternalConnectionString() {
  for (const envName of internalConnectionStringEnvNames) {
    const value = process.env[envName];
    if (value) {
      return value;
    }
  }

  return null;
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

function parseConnectionString(connectionString) {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

function getHostnameFromConnectionString(connectionString) {
  return parseConnectionString(connectionString)?.hostname?.toLowerCase?.() ?? "";
}

function getConnectionStringForSslMode(connectionString, sslEnabled) {
  const parsedUrl = parseConnectionString(connectionString);
  if (!parsedUrl) {
    return connectionString;
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

function deriveInternalConnectionStringFromRenderExternal() {
  if (process.env.RENDER !== "true") {
    return null;
  }

  const parsedUrl = parseDatabaseUrl();
  if (!parsedUrl || !isRenderExternalHost(parsedUrl.hostname.toLowerCase())) {
    return null;
  }

  const derivedHost = parsedUrl.hostname.split(".")[0];
  if (!derivedHost || derivedHost === parsedUrl.hostname) {
    return null;
  }

  parsedUrl.hostname = derivedHost;
  parsedUrl.searchParams.delete("ssl");
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("sslcert");
  parsedUrl.searchParams.delete("sslkey");
  parsedUrl.searchParams.delete("sslrootcert");
  return parsedUrl.toString();
}

function getSslAttemptPlanForHost(hostname) {
  const normalizedHost = hostname.toLowerCase();

  if (explicitDbSslSetting === "true") {
    return [true, false];
  }

  if (explicitDbSslSetting === "false") {
    return [false, true];
  }

  if (isLocalHost(normalizedHost) || isInternalHost(normalizedHost)) {
    return [false, true];
  }

  if (isRenderExternalHost(normalizedHost)) {
    return [true];
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
  const candidates = getConnectionCandidates();
  const plan = candidates
    .map((candidate) => `${candidate.host}:${describeSslMode(candidate.sslEnabled)}`)
    .join(" | ");

  return {
    host: getDatabaseHost() || "<unknown-host>",
    plan,
    explicitDbSslSetting: explicitDbSslSetting || "<unset>",
  };
}

function buildPool(connectionString, sslEnabled) {
  const pool = new Pool({
    connectionString: getConnectionStringForSslMode(connectionString, sslEnabled),
    ssl: sslEnabled
      ? {
          rejectUnauthorized: dbSslRejectUnauthorized,
        }
      : false,
    max: 10,
    idleTimeoutMillis: 3000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err);
  });

  return pool;
}

let currentSslEnabled = null;
let currentPool = null;
let currentConnectionString = null;

function getConnectionCandidates() {
  const candidates = [];
  const seen = new Set();
  const connectionStrings = [
   internalConnectionStringEnvNames,
    deriveInternalConnectionStringFromRenderExternal(),
    getRequiredConnectionString(),
  ].filter(Boolean);

  for (const connectionString of connectionStrings) {
    const host = getHostnameFromConnectionString(connectionString);
    const sslPlan = getSslAttemptPlanForHost(host);

    for (const sslEnabled of sslPlan) {
      const key = `${connectionString}|${sslEnabled}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({
        connectionString,
        host: host || "<unknown-host>",
        sslEnabled,
      });
    }
  }

  return candidates;
}

function getCurrentPool() {
  if (!currentPool) {
    const primaryCandidate = getConnectionCandidates()[0];
    currentSslEnabled = primaryCandidate.sslEnabled;
    currentConnectionString = primaryCandidate.connectionString;
    currentPool = buildPool(primaryCandidate.connectionString, primaryCandidate.sslEnabled);
  }

  return currentPool;
}

async function tryConnectWithPool(candidatePool, candidate) {
  await candidatePool.query("SELECT 1");

  if (candidatePool !== currentPool) {
    if (currentPool) {
      await currentPool.end().catch(() => {});
    }
    currentPool = candidatePool;
  }

  if (
    currentSslEnabled !== candidate.sslEnabled ||
    currentConnectionString !== candidate.connectionString
  ) {
    console.warn(
      `[DB] Switched startup connection to SSL ${describeSslMode(
        candidate.sslEnabled
      )} after the initial attempt failed.`
    );
  }

  currentSslEnabled = candidate.sslEnabled;
  currentConnectionString = candidate.connectionString;
}

async function tryCandidate(candidate, useCurrentPool = false) {
  const candidatePool = useCurrentPool
    ? getCurrentPool()
    : buildPool(candidate.connectionString, candidate.sslEnabled);

  try {
    await tryConnectWithPool(candidatePool, candidate);
    return null;
  } catch (error) {
    if (candidatePool !== currentPool) {
      await candidatePool.end().catch(() => {});
    }
    return error;
  }
}

export async function ensureDatabaseConnectivity() {
  const attempts = getConnectionCandidates();
  let lastError = null;

  for (let round = 0; round < startupRetryRounds; round += 1) {
    for (let index = 0; index < attempts.length; index += 1) {
      const candidate = attempts[index];
      const error = await tryCandidate(candidate, round === 0 && index === 0);
      if (!error) {
        return;
      }

      lastError = error;
      console.warn(
        `[DB] Startup connection attempt ${round + 1}/${startupRetryRounds} failed ` +
          `(host=${candidate.host}, ssl=${describeSslMode(
            candidate.sslEnabled
          )}, code=${error.code || "n/a"}): ${error.message}`
      );

      const hasMoreCandidates = index < attempts.length - 1;
      if (!hasMoreCandidates && round < startupRetryRounds - 1) {
        await wait(startupRetryDelayMs * (round + 1));
      }
    }
  }

  if (
    process.env.RENDER === "true" &&
    isRenderExternalHost(getDatabaseHost()) &&
    !getConfiguredInternalConnectionString()
  ) {
    lastError.message = `${lastError.message}. This Render service is using an external Render Postgres host. Prefer the Internal Database URL in Render, or set DATABASE_INTERNAL_URL.`;
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
