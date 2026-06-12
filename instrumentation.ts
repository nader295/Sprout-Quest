/**
 * Next.js 15 instrumentation hook — runs once per runtime on startup.
 * Used to initialize Sentry (optional) on Node + Edge.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentryNode } = await import("./lib/sentry");
    await initSentryNode();
  } else if (process.env.NEXT_RUNTIME === "edge") {
    const { initSentryEdge } = await import("./lib/sentry");
    await initSentryEdge();
  }
}

/**
 * Sentry wants a matching `onRequestError` hook so server-side request errors
 * (including in Server Components) are captured automatically.
 */
export async function onRequestError(
  err: unknown,
  request: unknown,
  context: unknown,
): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request as Parameters<typeof Sentry.captureRequestError>[1], context as Parameters<typeof Sentry.captureRequestError>[2]);
  } catch {
    // Sentry not installed or not initialized — silently ignore.
  }
}
