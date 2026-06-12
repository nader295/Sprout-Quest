import Link from "next/link";
import type { Metadata } from "next";
import { Compass, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "This page doesn't exist on RomX.",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {/* Animated 404 with glitch effect */}
      <div className="relative mb-8 select-none" aria-hidden="true">
        {/* Background glow */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[8rem] font-black leading-none blur-3xl opacity-15 animate-pulse"
          style={{ color: "var(--primary)", animationDuration: "3s" }}
        >
          404
        </span>
        {/* Glitch offset layer 1 */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[8rem] font-black leading-none opacity-[0.06]"
          style={{
            color: "#ef4444",
            transform: "translate(3px, -2px)",
            clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 45%)",
          }}
        >
          404
        </span>
        {/* Glitch offset layer 2 */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[8rem] font-black leading-none opacity-[0.06]"
          style={{
            color: "#3b82f6",
            transform: "translate(-3px, 2px)",
            clipPath: "polygon(0 55%, 100% 55%, 100% 100%, 0 100%)",
          }}
        >
          404
        </span>
        {/* Main number */}
        <span
          className="relative text-[8rem] font-black leading-none"
          style={{
            background:
              "linear-gradient(135deg, var(--primary) 0%, #60a5fa 50%, var(--primary) 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </span>
      </div>

      <h2 className="text-2xl font-black text-foreground mb-2">
        Page not found
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground mb-8 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="group relative flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white overflow-hidden transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--primary), #3b82f6)",
            boxShadow: "0 4px 16px var(--primary-dim)",
          }}
        >
          <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
          <Home className="h-4 w-4" />
          Go Home
        </Link>
        <Link
          href="/explore"
          className="flex items-center gap-2 rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:border-[var(--primary)]/30 transition-all active:scale-95"
        >
          <Compass className="h-4 w-4" />
          Explore ROMs
        </Link>
      </div>
    </div>
  );
}
