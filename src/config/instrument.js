import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const sentryDsn = process.env.SENTRY_DSN || "https://ff03aad97bd47ff578398ac2200f05c5@o4511855375220736.ingest.de.sentry.io/4511855394291792";

if (!sentryDsn) {
  console.warn("⚠️ Sentry DSN is not configured. Events will not be sent.");
}

Sentry.init({
  dsn: sentryDsn,
  integrations: [nodeProfilingIntegration()],
  enableLogs: true,
  tracesSampleRate: 1.0,
  profileSessionSampleRate: 1.0,
  profileLifecycle: "trace",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below.
    // userInfo: false,
    // httpBodies: [],
  },
});
