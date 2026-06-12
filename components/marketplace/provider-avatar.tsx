"use client";

import { cn } from "@/lib/utils";
import { BadgeCheck, EyeOff } from "lucide-react";
import Image from "next/image";

export interface ProviderAvatarProps {
  name: string;
  avatarUrl?: string | null;
  isAnonymous?: boolean;
  isVerified?: boolean;
  size?: number;
  showRing?: boolean;
  className?: string;
}

// Stable accent for initials fallback (avoid violet to stay on-brand).
function colorFor(seed: string) {
  const palette = ["#1d9bf0", "#10b981", "#f59e0b", "#06b6d4", "#0ea5e9", "#22c55e", "#eab308"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(name: string) {
  return (
    (name || "")
      .replace(/[^a-zA-Z\u0600-\u06FF ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function ProviderAvatar({
  name,
  avatarUrl,
  isAnonymous,
  isVerified,
  size = 40,
  showRing = true,
  className,
}: ProviderAvatarProps) {
  const accent = colorFor(name || "anon");
  const masked = !!isAnonymous;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={
          showRing
            ? {
                boxShadow: `0 0 0 2px rgb(var(--card)), 0 0 0 3px color-mix(in srgb, ${accent} 55%, transparent), 0 6px 18px -6px ${accent}80`,
              }
            : undefined
        }
      >
        {masked ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent}22 0%, rgb(var(--muted)) 70%)`,
            }}
          >
            <EyeOff
              className="opacity-70"
              style={{ width: size * 0.42, height: size * 0.42, color: accent }}
            />
          </div>
        ) : avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name || "avatar"}
            width={size}
            height={size}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-black"
            style={{
              fontSize: size * 0.38,
              color: "#fff",
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 60%, #000))`,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {initials(name)}
          </div>
        )}
      </div>

      {isVerified && !masked && (
        <div
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2 ring-card"
          style={{
            width: Math.max(14, size * 0.32),
            height: Math.max(14, size * 0.32),
            background: "var(--primary)",
            color: "white",
          }}
          aria-label="Verified"
          title="Verified"
        >
          <BadgeCheck
            style={{
              width: Math.max(10, size * 0.22),
              height: Math.max(10, size * 0.22),
            }}
          />
        </div>
      )}
    </div>
  );
}
