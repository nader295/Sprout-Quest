"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Loader2, RefreshCw, Package, Users, Flag, Zap, Activity,
} from "lucide-react";
import { apiAdminGetDashboardStats, apiAdminHealthStats } from "@/lib/api/client";
import { formatCount, cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

// Recharts is split to a separate chunk and rendered client-only to keep
// the admin bundle light on first load.
const ResponsiveContainer: any = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer as any), { ssr: false });
const BarChart: any = dynamic(() => import("recharts").then((m) => m.BarChart as any), { ssr: false });
const Bar: any = dynamic(() => import("recharts").then((m) => m.Bar as any), { ssr: false });
const XAxis: any = dynamic(() => import("recharts").then((m) => m.XAxis as any), { ssr: false });
const YAxis: any = dynamic(() => import("recharts").then((m) => m.YAxis as any), { ssr: false });
const Tooltip: any = dynamic(() => import("recharts").then((m) => m.Tooltip as any), { ssr: false });
const PieChart: any = dynamic(() => import("recharts").then((m) => m.PieChart as any), { ssr: false });
const Pie: any = dynamic(() => import("recharts").then((m) => m.Pie as any), { ssr: false });
const Cell: any = dynamic(() => import("recharts").then((m) => m.Cell as any), { ssr: false });

export function OverviewTab() {
  const [stats, setStats] = useState({ roms: 0, users: 0, reports: 0, kernels: 0, modules: 0, recoveries: 0 });
  const [health, setHealth] = useState<{ suspended: number; banned: number; pendingAppeals: number; totalXp: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false); // OPTIMIZATION: منع re-fetch عند tab switch

  const load = useCallback(async (force = false) => {
    if (!force && hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setLoading(true);
    const [s, h] = await Promise.all([
      apiAdminGetDashboardStats(),
      // Health widget is optional in the dashboard — UI hides it if unavailable,
      // but surface the cause so admins see why the panel is missing.
      apiAdminHealthStats().catch((err) => {
        logger.error("admin.overview.healthStats", err);
        return null;
      }),
    ]);
    setStats(s as typeof stats);
    if (h) setHealth(h);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const gsiCount = Math.max(0, stats.roms - stats.kernels - stats.modules - stats.recoveries);
  const pieData = [
    { name: "ROMs/GSI", value: gsiCount, fill: "#1d9bf0" },
    { name: "Kernels", value: stats.kernels, fill: "#10b981" },
    { name: "Modules", value: stats.modules, fill: "#f97316" },
    { name: "Recoveries", value: stats.recoveries, fill: "#f43f5e" },
  ];
  const barData = [
    { name: "ROMs", count: gsiCount },
    { name: "Kernels", count: stats.kernels },
    { name: "Modules", count: stats.modules },
    { name: "Recoveries", count: stats.recoveries },
  ];

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex justify-end">
        <button onClick={() => load(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total Releases", value: stats.roms, icon: Package, color: "text-blue-400 bg-blue-400/10" },
          { label: "Total Users", value: stats.users, icon: Users, color: "text-emerald-400 bg-emerald-400/10" },
          { label: "Pending Reports", value: stats.reports, icon: Flag, color: "text-amber-400 bg-amber-400/10" },
          { label: "Total XP Awarded", value: health?.totalXp ?? 0, icon: Zap, color: "text-cyan-400 bg-cyan-400/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", s.color)}><s.icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground leading-none">{formatCount(s.value)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {health && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-semibold text-foreground">Platform Health</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Banned Users", value: health.banned, color: health.banned > 0 ? "text-destructive" : "text-emerald-400", bg: health.banned > 0 ? "bg-destructive/10 border-destructive/20" : "bg-emerald-400/5 border-emerald-400/20" },
              { label: "Suspended", value: health.suspended, color: health.suspended > 0 ? "text-amber-400" : "text-emerald-400", bg: health.suspended > 0 ? "bg-amber-400/10 border-amber-400/20" : "bg-emerald-400/5 border-emerald-400/20" },
              { label: "Pending Appeals", value: health.pendingAppeals, color: health.pendingAppeals > 0 ? "text-blue-400" : "text-emerald-400", bg: health.pendingAppeals > 0 ? "bg-blue-400/10 border-blue-400/20" : "bg-emerald-400/5 border-emerald-400/20" },
            ].map((h) => (
              <div key={h.label} className={cn("rounded-lg border p-2 text-center", h.bg)}>
                <p className={cn("text-2xl font-black", h.color)}>{h.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3 overflow-hidden">
          <h3 className="text-xs font-semibold text-foreground mb-2">Content Distribution</h3>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "rgb(161,161,170)", fontSize: 9 }} />
                <YAxis tick={{ fill: "rgb(161,161,170)", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "rgb(10,10,18)", border: "1px solid rgb(39,39,42)", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "rgb(250,250,250)" }} itemStyle={{ color: "rgb(161,161,170)" }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 overflow-hidden">
          <h3 className="text-xs font-semibold text-foreground mb-2">Breakdown</h3>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={48} innerRadius={24} strokeWidth={2}>{pieData.map((entry, idx) => (<Cell key={idx} fill={entry.fill} stroke="transparent" />))}</Pie>
                <Tooltip contentStyle={{ background: "rgb(10,10,18)", border: "1px solid rgb(39,39,42)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">{pieData.map((p) => (<div key={p.name} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />{p.name}</div>))}</div>
        </div>
      </div>

      {/* REMOVED: Recent Activity section (moved to /admin/logs → Activity Tab) */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
        <span>For recent activity (users, releases, reports) visit</span>
        <Link href="/admin/logs" className="font-medium hover:text-foreground" style={{ color: "var(--primary)" }}>
          System Logs → Activity Tab →
        </Link>
      </div>
    </div>
  );
}
