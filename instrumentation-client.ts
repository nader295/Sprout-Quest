/**
 * Next.js 15 client-side instrumentation — runs once per browser session.
 * Initializes Sentry browser SDK (optional — no-op without DSN).
 */

import { initSentryBrowser } from "./lib/sentry";

initSentryBrowser().catch(() => {
  // Never let telemetry init break page load.
});
