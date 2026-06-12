"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Route-level boundary: log with digest so it can be correlated with
    // server logs (Vercel exposes the same digest in its build/runtime logs).
    logger.error("app.route.errorBoundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      {/* Error icon with animated glow */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-3xl blur-xl opacity-30 animate-pulse"
          style={{ backgroundColor: "var(--destructive, #ef4444)" }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-9 w-9 text-destructive" />
        </div>
      </div>

      {/* Error message */}
      <div className="max-w-md">
        <h2 className="text-xl font-black text-foreground mb-2">
          An unexpected error occurred
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-1">
          Something went wrong while loading this page. Please try again.
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/40 font-mono mt-2">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={reset}
          className="group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--primary), #3b82f6)",
            boxShadow: "0 4px 16px var(--primary-dim)",
          }}
        >
          <RefreshCcw className="h-4 w-4 transition-transform group-hover:rotate-180 duration-500" />
          Try Again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors active:scale-95"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
