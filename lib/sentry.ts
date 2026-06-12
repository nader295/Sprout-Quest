/**
 * Sentry integration — OPTIONAL by design.
 *
 * Why optional?
 *  - Local dev / open-source forks should NOT need a Sentry account to run.
 *  - If SENTRY_DSN is empty/missing, every helper becomes a silent no-op.
 *  - This keeps `logger.error(...)` a safe "fire-and-forget" choke point.
 *
 * How it's wired:
 *  - `instrumentation.ts`   → calls `initSentryNode()` / `initSentryEdge()`.
 *  - `instrumentation-client.ts` → calls `initSentryBrowser()`.
 *  - `lib/logger.ts` → forwards `error` level to `captureSentryException()`.
 *  - `lib/server/safe.ts` → wraps background promises in `safeFireAndForget`.
 */

// We import lazily inside each fn so builds without @sentry/nextjs fail gracefully
// (e.g. if the package install step was skipped in a fork).
type SentryMod = typeof import("@sentry/nextjs");

let sentry: SentryMod | null = null;
let enabled = false;

// Safe env reader — client bundles may not have `process` defined for
// non-NEXT_PUBLIC vars. We still read `NEXT_PUBLIC_*` and `NODE_ENV`
// directly because those ARE statically replaced by Next.js at build time.
function readEnv(key: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
  } catch {
    /* no-op */
  }
  return undefined;
}

/** Shared init options applied to every runtime. */
function commonOptions() {
  // NEXT_PUBLIC_SENTRY_DSN is statically inlined → safe for client.
  // SENTRY_DSN is server-only → guarded via readEnv so client bundle doesn't crash.
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    readEnv("SENTRY_DSN") ||
    "";
  return {
    dsn,
    enabled: dsn.length > 0,
    environment: readEnv("VERCEL_ENV") || process.env.NODE_ENV || "development",
    release: readEnv("VERCEL_GIT_COMMIT_SHA") || undefined,
    // Sampled traces — 10% in prod, 100% in dev. Keeps free-tier quota safe.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Scrub obvious secrets before send.
    // Typed loosely here because the options are consumed by 3 runtimes
    // (browser/node/edge) whose `ErrorEvent` shapes diverge slightly — but
    // the `request.headers` bag exists in all of them.
    beforeSend(event: unknown) {
      const req = (event as { request?: { headers?: Record<string, string> } }).request;
      if (req?.headers) {
        delete req.headers["authorization"];
        delete req.headers["cookie"];
        delete req.headers["x-api-key"];
      }
      return event as never;
    },
  };
}

async function loadSentry(): Promise<SentryMod | null> {
  if (sentry) return sentry;
  try {
    sentry = await import("@sentry/nextjs");
    return sentry;
  } catch {
    // Package missing — keep everything as no-op.
    return null;
  }
}

export async function initSentryNode(): Promise<void> {
  const opts = commonOptions();
  if (!opts.enabled) return;
  const s = await loadSentry();
  if (!s) return;
  s.init(opts);
  enabled = true;
}

export async function initSentryEdge(): Promise<void> {
  const opts = commonOptions();
  if (!opts.enabled) return;
  const s = await loadSentry();
  if (!s) return;
  s.init(opts);
  enabled = true;
}

export async function initSentryBrowser(): Promise<void> {
  const opts = commonOptions();
  if (!opts.enabled) return;
  const s = await loadSentry();
  if (!s) return;
  s.init(opts);
  enabled = true;
}

/**
 * Low-level capture — safe to call from anywhere. No-op if Sentry disabled.
 * Used by `logger.error` and by `safeFireAndForget`.
 */
export function captureSentryException(
  err: unknown,
  context?: { scope?: string; extra?: Record<string, unknown>; tags?: Record<string, string> },
): void {
  if (!enabled || !sentry) return;
  try {
    sentry.withScope((scope) => {
      if (context?.scope) scope.setTag("logger.scope", context.scope);
      if (context?.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
      }
      if (context?.extra) {
        for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v);
      }
      sentry!.captureException(err);
    });
  } catch {
    // Never let telemetry break the caller.
  }
}

/** Breadcrumb helper — useful from `logger.warn/info`. */
export function addSentryBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!enabled || !sentry) return;
  try {
    sentry.addBreadcrumb({ message, data, level: "info" });
  } catch {
    /* no-op */
  }
}

export function isSentryEnabled(): boolean {
  return enabled;
}
