import { Zap } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
      {/* Branded logo pulse */}
      <div className="relative">
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-2xl animate-ping"
          style={{
            backgroundColor: "var(--primary-dim)",
            animationDuration: "1.5s",
          }}
        />
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card"
          style={{
            boxShadow: "0 0 24px var(--primary-dim)",
          }}
        >
          <Zap
            className="h-6 w-6 animate-pulse"
            style={{ color: "var(--primary)" }}
          />
        </div>
      </div>

      {/* Loading text with dot animation */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
        <span>Loading</span>
        <span className="flex gap-0.5">
          <span
            className="inline-block h-1 w-1 rounded-full animate-bounce"
            style={{
              backgroundColor: "var(--primary)",
              animationDelay: "0ms",
              animationDuration: "1s",
            }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full animate-bounce"
            style={{
              backgroundColor: "var(--primary)",
              animationDelay: "150ms",
              animationDuration: "1s",
            }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full animate-bounce"
            style={{
              backgroundColor: "var(--primary)",
              animationDelay: "300ms",
              animationDuration: "1s",
            }}
          />
        </span>
      </div>
    </div>
  );
}
