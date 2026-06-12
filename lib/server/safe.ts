/**
 * Safe fire-and-forget helpers — replaces the `.catch(() => {})` anti-pattern.
 *
 * Before:
 *   someAsyncThing().catch(() => {});  // ← silent failure, no visibility
 *
 * After:
 *   safeFireAndForget(someAsyncThing(), "cron.presence-cleanup");
 *
 * What changes:
 *  - Errors go through `logger.error` (structured logs) AND Sentry (if enabled).
 *  - The caller still never throws/awaits — drop-in replacement.
 *
 * Why it lives in `lib/server/`:
 *  - Most fire-and-forget in this repo is server-side (cron, XP grants, notifs).
 *  - Kept runtime-agnostic (works from Node + Edge).
 */

import { logger } from "@/lib/logger";
import { captureSentryException } from "@/lib/sentry";

type Meta = Record<string, unknown>;

/**
 * Run a promise in the background. Never throws. Any rejection is
 * routed to the logger (and Sentry, when configured).
 *
 * @param promise - The in-flight promise (or a thunk that returns one).
 * @param scope   - Short dotted identifier — e.g. "xp.grant", "notif.push".
 * @param meta    - Optional extra context attached to the log + Sentry event.
 */
export function safeFireAndForget(
  promise: Promise<unknown> | (() => Promise<unknown>),
  scope: string,
  meta?: Meta,
): void {
  const p = typeof promise === "function" ? safeInvoke(promise, scope, meta) : promise;
  p.catch((err: unknown) => {
    logger.error(scope, err, meta);
    captureSentryException(err, { scope, extra: meta });
  });
}

/** Guards synchronous throws inside a thunk — returns a rejected promise instead. */
function safeInvoke(fn: () => Promise<unknown>, scope: string, meta?: Meta): Promise<unknown> {
  try {
    return fn();
  } catch (err) {
    logger.error(scope, err, meta);
    captureSentryException(err, { scope, extra: meta });
    return Promise.reject(err);
  }
}

/**
 * Same idea but for code paths that already use try/catch and want to
 * report without swallowing. Returns the error so callers can branch.
 */
export function reportError(err: unknown, scope: string, meta?: Meta): void {
  logger.error(scope, err, meta);
  captureSentryException(err, { scope, extra: meta });
}
