"use client";

import { formatCount } from "@/lib/utils";
import { Ban, Loader2, Package, Scale, UserX, Users, Zap } from "lucide-react";

export function OwnerQuickStats({ health, loading }: {
  health: { suspended: number; banned: number; pendingAppeals: number; totalRoms: number; totalUsers: number; totalXp: number } | null;
  loading: boolean;
}) {
  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!health) return null;

  const stats = [
    { label: "Total Users", value: health.totalUsers, icon: Users, color: "#3b82f6" },
    { label: "Total Releases", value: health.totalRoms, icon: Package, color: "#10b981" },
    { label: "Total XP Awarded", value: health.totalXp, icon: Zap, color: "#f59e0b" },
    { label: "Banned Users", value: health.banned, icon: Ban, color: health.banned > 0 ? "#ef4444" : "#10b981" },
    { label: "Suspended", value: health.suspended, icon: UserX, color: health.suspended > 0 ? "#f59e0b" : "#10b981" },
    { label: "Pending Appeals", value: health.pendingAppeals, icon: Scale, color: health.pendingAppeals > 0 ? "#3b82f6" : "#10b981" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="group relative rounded-2xl border border-border bg-card p-4 overflow-hidden transition-all hover:border-[var(--primary)]/30 hover:bg-[var(--primary-dim)]">
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-black text-foreground tracking-tight">{formatCount(s.value)}</p>
          </div>
          <div className="absolute -bottom-4 -right-4 h-20 w-20 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
            <s.icon className="h-full w-full" style={{ color: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
