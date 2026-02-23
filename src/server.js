import "./config/env.js";
import app from "./app.js";
import pool from "./config/db.js";
import { initializeDatabaseTablesSafe } from "./data/initDb.safe.js";
import { transporter } from "./utils/email.js";

const PORT = process.env.PORT || 5001;
const requireSmtpOnStartup = process.env.REQUIRE_SMTP_ON_STARTUP === "true";

const validateStartupEnv = () => {
  const requiredVars = ["DATABASE_URL", "JWT_SECRET"];
  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

const formatDbError = (err) => {
  if (!err) return "Unknown database error";

  const code = err.code ? ` (code: ${err.code})` : "";

  switch (err.code) {
    case "ECONNREFUSED":
      return `Database connection refused${code}. Check DATABASE_URL host/port and ensure PostgreSQL is running.`;
    case "ECONNRESET":
      return `Database connection reset${code}. The DB server closed the connection unexpectedly; verify network/SSL settings and DB availability.`;
    case "ENOTFOUND":
      return `Database host not found${code}. Check DATABASE_URL host value.`;
    case "28P01":
      return `Database authentication failed${code}. Check DB username/password in DATABASE_URL.`;
    case "3D000":
      return `Database does not exist${code}. Check DB name in DATABASE_URL.`;
    default:
      return `${err.message}${code}`;
  }
};

const formatSmtpError = (err) => {
  if (!err) return "Unknown SMTP error";
  const code = err.code ? ` (code: ${err.code})` : "";

  if (err.code === "EAUTH") {
    return `SMTP authentication failed${code}. Check SMTP credentials/app password configuration.`;
  }

  return `${err.message}${code}`;
};

/* -------------------------------------------------------------------------- */
/*                                APP STARTUP                                 */
/* -------------------------------------------------------------------------- */
const start = async () => {
  try {
    validateStartupEnv();

    await pool.query("SELECT 1");
    console.log("✅ Database connection successful");

    await initializeDatabaseTablesSafe();
    console.log("✅ Database tables ensured");

    try {
      await transporter.verify();
      console.log("✅ SMTP connection successful");
    } catch (smtpErr) {
      const smtpMessage = formatSmtpError(smtpErr);
      if (requireSmtpOnStartup) {
        throw new Error(smtpMessage);
      }
      console.warn(`⚠️ SMTP unavailable: ${smtpMessage}`);
      console.warn(
        "⚠️ Continuing startup because REQUIRE_SMTP_ON_STARTUP is not true."
      );
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    const message = formatDbError(err);
    console.error("❌ Startup failed:", message);
    process.exit(1);
  }
};

start();
