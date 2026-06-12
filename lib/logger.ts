/**
 * Minimal structured logger.
 *
 * Why not console.* everywhere?
 *  - Silent `catch {}` swallows useful production errors.
 *  - Raw console lines can't be filtered by severity or scope.
 *  - Keeping one choke point lets us plug Sentry/Axiom/etc later in ONE place.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.warn("auth.missing-token", { path });
 *   logger.error("cron.presence-cleanup", err, { count });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type Meta = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Safe env access — in a client bundle `process` may be undefined and only
// `process.env.NODE_ENV` + `process.env.NEXT_PUBLIC_*` are statically replaced.
// We intentionally read ONLY the inlined literals here.
const IS_PROD = process.env.NODE_ENV === "production";

// Default: debug in dev, info in prod. LOG_LEVEL is server-only (no NEXT_PUBLIC
// prefix) so we only try to read it when `process` actually exists at runtime.
function currentMinLevel(): number {
  try {
    if (typeof process !== "undefined" && process.env) {
      const raw = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
      if (LEVELS[raw] != null) return LEVELS[raw];
    }
  } catch {
    // Accessing process in some client bundles can throw — fall through.
  }
  return IS_PROD ? LEVELS.info : LEVELS.debug;
}

function serializeError(err: unknown): Meta {
  if (err instanceof Error) {
    return {
      errName: err.name,
      errMessage: err.message,
      // Stack only in non-prod to keep prod logs compact.
      ...(!IS_PROD ? { errStack: err.stack } : {}),
    };
  }
  if (typeof err === "object" && err !== null) {
    try {
      return { errRaw: JSON.stringify(err) };
    } catch {
      return { errRaw: String(err) };
    }
  }
  return { errRaw: String(err) };
}

// Lazy Sentry handles — imported dynamically so this file stays dependency-free
// when Sentry isn't installed or DSN is absent. `forwardToSentry` is a no-op
// unless `lib/sentry.ts` has initialized the SDK.
let sentryForward: ((err: unknown, scope: string, meta?: Meta) => void) | null = null;
let sentryBreadcrumb: ((msg: string, data?: Meta) => void) | null = null;

// Fire a single dynamic import; if it fails, both refs stay null forever.
// Using .then instead of top-level await to keep CJS compat.
import("./sentry")
  .then((mod) => {
    sentryForward = (err, scope, meta) =>
      mod.captureSentryException(err, { scope, extra: meta });
    sentryBreadcrumb = (msg, data) => mod.addSentryBreadcrumb(msg, data);
  })
  .catch(() => {
    /* Sentry not available — logger falls back to console only. */
  });

function emit(level: LogLevel, scope: string, err: unknown | null, meta?: Meta): void {
  if (LEVELS[level] < currentMinLevel()) return;

  const payload: Meta = {
    level,
    scope,
    ts: new Date().toISOString(),
    ...(err != null ? serializeError(err) : {}),
    ...(meta || {}),
  };

  // Use the matching console method so Vercel dashboards + CI classify correctly.
  const fn =
    level === "error" ? console.error :
    level === "warn"  ? console.warn  :
    level === "debug" ? console.debug :
                        console.info;

  // Space-prefix keeps logs greppable in shared terminals.
  fn(`[v0:${scope}]`, payload);

  // ── Sentry forwarding ──────────────────────────────────────────────────
  // error → captureException (with scope tag + extra meta)
  // warn/info → breadcrumb (shows up in next captured error's timeline)
  // debug → skipped (would drown the breadcrumb buffer)
  if (level === "error" && sentryForward) {
    sentryForward(err ?? new Error(scope), scope, meta);
  } else if ((level === "warn" || level === "info") && sentryBreadcrumb) {
    sentryBreadcrumb(`[${scope}] ${level}`, meta);
  }
}

export const logger = {
  debug: (scope: string, meta?: Meta) => emit("debug", scope, null, meta),
  info:  (scope: string, meta?: Meta) => emit("info",  scope, null, meta),
  warn:  (scope: string, meta?: Meta) => emit("warn",  scope, null, meta),
  /**
   * Record a caught error without crashing the caller. Returns nothing so it
   * can be dropped into `.catch(err => logger.error(...))` or plain try/catch.
   */
  error: (scope: string, err: unknown, meta?: Meta) => emit("error", scope, err, meta),
};
