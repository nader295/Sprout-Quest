"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGetFollowingListWithData, apiGetUser } from "@/lib/api/client";
import type { UserDoc } from "@/lib/types";
import { safeImg } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { Users, ArrowLeft, Loader2, Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n"; // Added import

export default function FollowingPage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation(); // Added hook
  const [users, setUsers]             = useState<UserDoc[]>([]);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setUsers([]);
    try {
      const [following, profile] = await Promise.all([
        apiGetFollowingListWithData(uid, 200),
        apiGetUser(uid),
      ]);
      setUsers(Array.isArray(following) ? following : []);
      if (profile?.name) setProfileName(profile.name);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? users.filter(u =>
        (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.username || "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground">{t('following.title')}</h1>
          {profileName && (
            <p className="text-xs text-muted-foreground">{t('following.desc2')} {profileName}</p>
          )}
        </div>
        {!loading && users.length > 0 && (
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
            {users.length}
          </span>
        )}
      </div>

      {/* Search bar */}
      {!loading && users.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('following.search')}
            className="w-full ps-9 pe-8 h-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card mb-3">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {search ? t('following.noResults') : t('following.noFollowingYet')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Link
              key={u.uid || u.id}
              href={`/u/${u.uid || u.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/30 hover:border-border/80 transition-all">
              <Image
                src={safeImg(u.photo, DEFAULT_AVATAR)}
                alt={u.name || "user"}
                width={40} height={40}
                className="rounded-full border border-border object-cover shrink-0"
                crossOrigin="anonymous"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                {u.username && (
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
