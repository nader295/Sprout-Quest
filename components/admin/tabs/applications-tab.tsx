"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, BadgeCheck, Github, ExternalLink as ExternalLinkIcon, Check, X } from "lucide-react";
import { apiAdminListApplications, apiAdminHandleApplication } from "@/lib/api/client";
import type { DeveloperApplication } from "@/lib/types";
import { fmtDate, safeImg, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";

export function ApplicationsTab() {
  const [apps, setApps] = useState<DeveloperApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiAdminListApplications("all").then((res) => setApps(res || [])).finally(() => setLoading(false));
  }, []);

  const handleDecision = async (id: string, status: "approved" | "rejected") => {
    await apiAdminHandleApplication(id, status);
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted-foreground mb-3">{apps.length} applications</p>
      {apps.length === 0 ? (
        <div className="text-center py-16">
          <BadgeCheck className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((a) => (
            <div key={a.id} className={cn("rounded-xl border bg-card p-4", a.status === "pending" ? "border-amber-400/30" : a.status === "approved" ? "border-emerald-400/30" : "border-border opacity-70")}>
              <div className="flex items-start gap-3">
                <Image src={safeImg(a.photo, DEFAULT_AVATAR)} alt={a.name} width={40} height={40} className="rounded-full shrink-0" crossOrigin="anonymous" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{a.name}</span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", a.status === "pending" ? "text-amber-400 bg-amber-400/10" : a.status === "approved" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>{a.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.email}</p>
                  <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground">Experience:</span> {a.experience}</p>
                  <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium text-foreground">Reason:</span> {a.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {a.githubUrl && <a href={a.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Github className="h-3 w-3" /> GitHub</a>}
                    {a.xdaUrl && <a href={a.xdaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLinkIcon className="h-3 w-3" /> XDA</a>}
                    {a.sampleRomUrl && <a href={a.sampleRomUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLinkIcon className="h-3 w-3" /> Sample ROM</a>}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{fmtDate(a.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {a.status === "pending" && (
                    <>
                      <button onClick={() => handleDecision(a.id, "approved")} className="rounded-lg p-1.5 text-emerald-400 hover:text-emerald-300" title="Approve"><Check className="h-4 w-4" /></button>
                      <button onClick={() => handleDecision(a.id, "rejected")} className="rounded-lg p-1.5 text-red-400 hover:text-red-300" title="Reject"><X className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
