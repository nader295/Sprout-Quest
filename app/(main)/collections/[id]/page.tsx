"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiGetCollection, apiRemoveFromCollection, apiListRoms } from "@/lib/api/client";
import type { Collection, RomItem } from "@/lib/types";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import Link from "next/link";
import { ArrowLeft, Folder, Lock, Globe2, Trash2, Loader2, Package } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [col, setCol] = useState<Collection | null>(null);
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGetCollection(id)
      .then(async (data) => {
        if (!data) { setLoading(false); return; }
        setCol(data);
        if (data.romIds?.length) {
          const result = await apiListRoms({ ids: data.romIds.slice(0, 24) });
          setRoms(result.items);
          setHasMore(data.romIds.length > 24);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadMore = useCallback(async () => {
    if (!col || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextBatchIds = col.romIds.slice(roms.length, roms.length + 24);
      if (nextBatchIds.length > 0) {
        const result = await apiListRoms({ ids: nextBatchIds });
        setRoms((prev) => [...prev, ...result.items]);
        setHasMore(col.romIds.length > roms.length + nextBatchIds.length);
      } else {
        setHasMore(false);
      }
    } finally { setLoadingMore(false); }
  }, [col, hasMore, loadingMore, roms.length]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) loadMore();
    }, { threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  const handleRemoveRom = useCallback(async (romId: string) => {
    if (!id || !col) return;
    setRemoving(romId);
    try {
      await apiRemoveFromCollection(id, romId);
      setRoms((prev) => prev.filter((r) => r.id !== romId));
      setCol((prev) => prev ? { ...prev, romIds: prev.romIds.filter((r) => r !== romId), romCount: Math.max(prev.romCount - 1, 0) } : prev);
    } finally {
      setRemoving(null);
    }
  }, [id, col]);

  const isOwner = user?.uid && col?.ownerUid === user.uid;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6"><div className="h-5 w-5 animate-pulse rounded bg-muted" /><div className="h-5 w-36 animate-pulse rounded bg-muted sm:h-6 sm:w-48" /></div>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 3 }).map((_, i) => (<RomCardSkeleton key={i} />))}</div>
      </div>
    );
  }

  if (!col) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Folder className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-foreground font-medium">{t("collections.notFound")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("collections.empty")}</p>
        <Link href="/collections" className="mt-4 text-sm font-medium" style={{ color: "var(--primary)" }}>{t("collections.backTo")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <div className="mb-4 sm:mb-6">
        <Link href="/collections" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 sm:mb-3 sm:text-sm"><ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 icon-dir" /> {t("collections.backTo")}</Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Folder className="h-5 w-5" style={{ color: "var(--primary)" }} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground sm:text-xl">{col.name}</h1>
              {col.isPublic ? <Globe2 className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            </div>
            {col.description && <p className="text-sm text-muted-foreground mt-0.5">{col.description}</p>}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Package className="h-4 w-4" /> {roms.length} items</div>
        </div>
      </div>
      {roms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t("collections.empty")}</p>
          <Link href="/explore" className="mt-3 text-sm font-medium" style={{ color: "var(--primary)" }}>{t("collections.browseRoms")}</Link>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roms.map((rom) => (
            <div key={rom.id} className="relative group">
              <RomCard rom={rom} />
              {isOwner && (
                <button onClick={() => handleRemoveRom(rom.id)} disabled={removing === rom.id} className="absolute end-2 top-2 z-10 rounded-lg bg-card/90 p-1.5 text-destructive opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:opacity-50" aria-label={t("collections.removeFrom")}>
                  {removing === rom.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-4 mt-2">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("common.loading") || "Loading..."}
              </div>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}
