"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiAdminHealthStats } from "@/lib/api/client";
import { CheckCircle, Crown, ShieldAlert } from "lucide-react";
import { logger } from "@/lib/logger";
import { OwnerVisibilityToggles } from "./owner-visibility-toggles";
import { OwnerChannelLinkControl } from "./owner-channel-link-control";
import { OwnerDeveloperLevelControl } from "./owner-developer-level-control";
import { OwnerQuickStats } from "./owner-quick-stats";
import { OwnerMonetizationStats } from "./owner-monetization-stats";
import { OwnerAdSettings } from "./owner-ad-settings";
import { OwnerRevenueVault } from "./owner-revenue-vault";
import { PayoutRequestsManager } from "./payout-requests-manager";
import { PlatformConfigPanel } from "./platform-config-panel";
import { MigrationsPanel } from "./migrations-panel";
import { DangerZone } from "./danger-zone";

export function OwnerTab() {
  const { userDoc } = useAuth();
  const [health, setHealth] = useState<{ suspended: number; banned: number; pendingAppeals: number; totalRoms: number; totalUsers: number; totalXp: number } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    apiAdminHealthStats()
      .then(setHealth)
      .catch((err) => logger.error("owner.index.healthStats", err))
      .finally(() => setLoadingHealth(false));
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/30"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(var(--card-rgb),1))" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(245,158,11,0.15), transparent 70%)" }} />
        <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 ring-1 ring-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Crown className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-amber-400 tracking-tight">Owner Command Center</h2>
              <p className="text-xs text-muted-foreground mt-1">Platform overview for <strong className="text-foreground">{userDoc?.name}</strong>.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 w-fit">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase">Superadmin Active</span>
          </div>
        </div>
      </div>

      <OwnerVisibilityToggles />
      <OwnerChannelLinkControl />
      <OwnerDeveloperLevelControl />
      <OwnerQuickStats health={health} loading={loadingHealth} />
      <OwnerMonetizationStats />
      <OwnerAdSettings />
      <OwnerRevenueVault />
      <PayoutRequestsManager />
      <PlatformConfigPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MigrationsPanel />
        <DangerZone />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-foreground">Your Privileges</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          {[
            "Full access to all admin controls",
            "Promote/demote admins & moderators",
            "Ban/unban any user including admins",
            "Delete any content on the platform",
            "Incognito mode — hide owner badge",
            "Bypass all private profile restrictions",
            "Run database migrations",
            "Export user data as CSV",
            "Platform-wide broadcast messages",
            "Cannot be suspended or auto-moderated",
          ].map((priv) => (
            <div key={priv} className="flex items-center gap-2.5 text-xs">
              <div className="h-4 w-4 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
              </div>
              <span className="text-muted-foreground">{priv}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
