"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, Eye, Heart, Download, Star, Trash2 } from "lucide-react";
import { apiListRoms, apiAdminDeleteRom, apiAdminSetFeatured } from "@/lib/api/client";
import type { RomItem } from "@/lib/types";
import { formatCount, cn, getContentTypeLabel, getStatusColor } from "@/lib/utils";

export function RomsTab() {
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false); // OPTIMIZATION: منع re-fetch عند tab switch

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // OPTIMIZATION: max:50 → max:20 (-60% reads)
    apiListRoms({ max: 20, sortBy: "newest" }).then((res) => setRoms(res.items || [])).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ROM permanently?")) return;
    await apiAdminDeleteRom(id);
    setRoms((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFeature = async (id: string, featured: boolean) => {
    await apiAdminSetFeatured(id, !featured);
    setRoms((prev) => prev.map((r) => r.id === id ? { ...r, featured: !featured } : r));
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <p className="text-sm text-muted-foreground mb-3">{roms.length} releases loaded</p>
      <div className="flex flex-col gap-2">
        {roms.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/rom/${r.id}`} className="text-sm font-medium text-foreground hover:underline truncate">{r.name}</Link>
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", getStatusColor(r.romStatus))}>{r.romStatus}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{getContentTypeLabel(r.contentType)}</span>
                {r.featured && <span className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">FEATURED</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.device} -- {r.brand} -- by {r.maintainerName}</p>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {formatCount(r.total_views)}</span>
                <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {formatCount(r.likesCount)}</span>
                <span className="flex items-center gap-0.5"><Download className="h-3 w-3" /> {formatCount(r.downloads)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => handleFeature(r.id, r.featured)} className={cn("rounded-lg p-1.5 transition-colors", r.featured ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground")} title="Toggle featured"><Star className={cn("h-4 w-4", r.featured && "fill-current")} /></button>
              <button onClick={() => handleDelete(r.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
