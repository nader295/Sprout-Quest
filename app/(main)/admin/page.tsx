"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bug,
  ChevronDown,
  Crown,
  Flag,
  ImageIcon,
  Loader2,
  Megaphone,
  Package,
  Scale,
  Shield,
  ShieldAlert,
  Smartphone,
  Terminal,
  Users,
} from "lucide-react";

import { OverviewTab }        from "@/components/admin/tabs/overview-tab";
import { RomsTab }            from "@/components/admin/tabs/roms-tab";
import { UsersTab }           from "@/components/admin/tabs/users-tab";
import { ReportsTab }         from "@/components/admin/tabs/reports-tab";
import { AppealsTab }         from "@/components/admin/tabs/appeals-tab";
import { ApplicationsTab }    from "@/components/admin/tabs/applications-tab";
import { AnnouncementsTab }   from "@/components/admin/tabs/announcements-tab";
import { DevicesTab }         from "@/components/admin/tabs/devices-tab";
import { ArchiveReportsTab }  from "@/components/admin/tabs/archive-reports-tab";
import { ImagesTab }          from "@/components/admin/tabs/images-tab";
import { FraudTab }           from "@/components/admin/tabs/fraud-tab";
import { BugReportsTab }      from "@/components/admin/tabs/bug-reports-tab";
import { OwnerTab }           from "@/components/admin/tabs/owner";

type Tab =
  | "overview"
  | "roms"
  | "users"
  | "reports"
  | "appeals"
  | "applications"
  | "announcements"
  | "devices"
  | "archive_reports"
  | "images"
  | "fraud"
  | "bugs"
  | "owner";

export default function AdminPage() {
  const { isAdmin, isOwner, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You need admin privileges to access this page.
        </p>
      </div>
    );
  }

  const CATEGORIES = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
      tabs: [{ id: "overview", label: "Overview", icon: BarChart3 }],
    },
    {
      id: "content",
      label: "Content",
      icon: Package,
      tabs: [
        { id: "roms",    label: "ROMs",       icon: Package },
        { id: "devices", label: "Devices DB", icon: Smartphone },
        { id: "images",  label: "Images",     icon: ImageIcon },
      ],
    },
    {
      id: "community",
      label: "Community",
      icon: Users,
      tabs: [
        { id: "users",         label: "Users",         icon: Users },
        { id: "applications",  label: "Applications",  icon: BadgeCheck },
        { id: "announcements", label: "Announcements", icon: Megaphone },
      ],
    },
    {
      id: "moderation",
      label: "Moderation",
      icon: ShieldAlert,
      tabs: [
        { id: "reports",         label: "Reports",     icon: Flag },
        { id: "appeals",         label: "Appeals",     icon: Scale },
        { id: "fraud",           label: "Anti-Fraud",  icon: ShieldAlert },
        { id: "bugs",            label: "Bug Reports", icon: Bug },
        { id: "archive_reports", label: "Archive Fix", icon: AlertTriangle },
      ],
    },
  ];

  const currentCategory =
    CATEGORIES.find(c => c.tabs.some(t => t.id === tab))?.id ||
    (tab === "owner" ? "owner" : "dashboard");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Shield className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--primary)" }} />
          <div>
            <h1 className="text-lg font-bold text-foreground sm:text-xl">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Manage the platform securely.</p>
          </div>
        </div>
        <Link
          href="/admin/logs"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">System Logs</span>
          <span className="sm:hidden">Logs</span>
        </Link>
      </div>

      {/* Mobile Select Dropdown for Tabs */}
      <div className="sm:hidden mb-4">
        <div className="relative">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-sm"
          >
            {CATEGORIES.map(c => (
              <optgroup key={c.id} label={c.label}>
                {c.tabs.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
            {isOwner && (
              <optgroup label="Owner Platform Setup">
                <option value="owner">Owner Controls & Logs</option>
              </optgroup>
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden sm:block">
        <div className="flex items-center gap-1 sm:gap-2 mb-1 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((c) => {
            const isActive = currentCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setTab(c.tabs[0].id as Tab)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 pt-2 pb-1.5 text-sm font-bold transition-all border-b-2 origin-bottom",
                  isActive
                    ? "border-[var(--primary)] text-foreground bg-primary-dim/30"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <c.icon className="h-4 w-4" /> {c.label}
              </button>
            );
          })}
          {isOwner && (
            <button
              onClick={() => setTab("owner")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 pt-2 pb-1.5 text-sm font-bold transition-all border-b-2 origin-bottom",
                currentCategory === "owner"
                  ? "border-amber-500 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/5"
              )}
            >
              <Crown className="h-4 w-4" /> Owner
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 border-b border-border/60 pb-3 mb-4 overflow-x-auto scrollbar-none px-1">
          {currentCategory !== "owner" &&
            CATEGORIES.find(c => c.id === currentCategory)?.tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
                  tab === t.id
                    ? "bg-[var(--primary)] text-white border-transparent shadow-sm"
                    : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <t.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* CSS hidden → retains tab state between switches */}
      <div className={tab === "overview"        ? "" : "hidden"}><OverviewTab /></div>
      <div className={tab === "roms"            ? "" : "hidden"}><RomsTab /></div>
      <div className={tab === "users"           ? "" : "hidden"}><UsersTab /></div>
      <div className={tab === "reports"         ? "" : "hidden"}><ReportsTab /></div>
      <div className={tab === "appeals"         ? "" : "hidden"}><AppealsTab /></div>
      <div className={tab === "applications"    ? "" : "hidden"}><ApplicationsTab /></div>
      <div className={tab === "announcements"   ? "" : "hidden"}><AnnouncementsTab /></div>
      <div className={tab === "devices"         ? "" : "hidden"}><DevicesTab /></div>
      <div className={tab === "archive_reports" ? "" : "hidden"}><ArchiveReportsTab /></div>
      <div className={tab === "images"          ? "" : "hidden"}><ImagesTab /></div>
      <div className={tab === "fraud"           ? "" : "hidden"}><FraudTab /></div>
      <div className={tab === "bugs"            ? "" : "hidden"}><BugReportsTab /></div>
      {tab === "owner" && isOwner && <OwnerTab />}
    </div>
  );
}
