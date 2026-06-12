"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional tag used when logging, so you can tell which boundary tripped. */
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Component-level error boundary.
 *
 * Previous behaviour reloaded the whole page on "Try again", which threw away
 * in-memory state (draft forms, open drawers, optimistic updates). We now
 * attempt an in-place reset first — if the child re-renders without throwing,
 * the user keeps their session. If the child still throws, React will call
 * getDerivedStateFromError again and the fallback reappears, at which point
 * the user can choose to reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Structured log so these boundaries show up alongside server errors.
    logger.error("ui.errorBoundary", {
      boundary: this.props.boundaryName || "unknown",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-16 text-center px-4"
        >
          <AlertTriangle className="h-10 w-10 text-destructive mb-3" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            An unexpected error occurred. Try resetting this section; if the problem
            persists, reload the whole page.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
