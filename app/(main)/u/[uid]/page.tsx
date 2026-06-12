"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ImageEditorModal } from "@/components/shared/ImageEditorModal";
import { createObjectURL } from "@/lib/utils/cropImage";
import { appCache, CacheKeys } from "@/lib/cache";
import {
  apiGetUser, apiCheckFollowing, apiFollow, apiUnfollow, apiUpdateProfile,
  apiListRoms,
} from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCount, fmtDate, safeImg, cn } from "@/lib/utils";
import { getLevel, getNextLevel, ACHIEVEMENTS, DEFAULT_AVATAR, CLOUDINARY_CONFIG, getDefaultAvatar } from "@/lib/constants";
import type { UserDoc, RomItem, ChannelLink, DonationLink, ProfileLink } from "@/lib/types";
import { RomCard } from "@/components/rom/rom-card";
import { useTranslation } from "@/lib/i18n";
import Image from "next/image";
import { toast } from "@/components/shared/toast";
import Link from "next/link";
import {
  UserPlus, UserCheck, User, Settings, Github, Send, Globe, ExternalLink,
  Calendar, Award, Heart, Download, Eye, Package,
  Check, Loader2, Shield, Camera, Mail, AtSign, Crown, Zap, Clock,
  BarChart2, Users, Pin, Image as ImageIcon, Star, Gem,
  EyeOff, ChevronRight, Lock, Trophy, TrendingUp, Info, ChevronUp,
  MessageSquare, Rocket, Youtube, DollarSign, Link2, Plus, Trash2,
  ChevronDown, Coffee, X as XIcon, FileText, Layers,
} from "lucide-react";

// ── Extracted profile sub-components (Wave 12) ──────────────────────────────
// These used to live inline in this file (2562 → 1442 lines after extraction).
// Each is independently testable and memo-friendly.
import { LevelBadge, DistinctionBadge } from "@/components/profile/level-badge";
import { XpLevelCard } from "@/components/profile/xp-level-card";
import { AnalyticsTab } from "@/components/profile/analytics-tab";
import {
  EditSocialLinks, EditDonationLinks, buildProfileLinks,
  LINK_PLATFORMS, PLATFORM_COLORS, DONATION_PLATFORMS,
} from "@/components/profile/social-links";
import { COVER_PRESETS, getCoverStyle } from "@/components/profile/cover-presets";
import { PrivacyToggle } from "@/components/profile/privacy-toggle";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";
import { UserMarketplaceSection } from "@/components/marketplace/user-marketplace-section";
import { logger } from "@/lib/logger";

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user, userDoc: authDoc, isLoggedIn, loading: authLoading, isAdmin, isOwner: isAuthOwner, updateFirebaseProfile } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [channelLinkMinXP, setChannelLinkMinXP] = useState<number>(0);
  const [donationMinXP, setDonationMinXP] = useState<number>(0);
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [nextCursorRoms, setNextCursorRoms] = useState<string | null>(null);
  const [loadingMoreRoms, setLoadingMoreRoms] = useState(false);
  const observerTargetRoms = useRef<HTMLDivElement>(null);
  const [likedRoms, setLikedRoms] = useState<RomItem[]>([]);
  const [collections, setCollections] = useState<{id:string;name:string;romsCount:number;thumbnail?:string}[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [pinnedRom, setPinnedRom] = useState<RomItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState("");
  const [tab, setTab] = useState<"roms" | "library" | "achievements" | "analytics">("roms");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", bio: "", username: "", pinnedRomId: "",
    // Keep old social fields for backward compat on save
    github: "", telegram: "", xda: "", twitter: "", website: "", youtube: "",
  });
  const [editProfileLinks, setEditProfileLinks] = useState<ProfileLink[]>([]);
  const [editChannelLinks, setEditChannelLinks] = useState<ChannelLink[]>([]);
  const [editDonationLinks, setEditDonationLinks] = useState<DonationLink[]>([]);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [editIncognitoMode, setEditIncognitoMode] = useState(false);
  const [editHideDownloads, setEditHideDownloads] = useState(false);
  const [editHideFollowers, setEditHideFollowers] = useState(false);
  const [editPrivateProfile, setEditPrivateProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [editModalTab, setEditModalTab] = useState<"info" | "links" | "donate" | "privacy">("info");
  // ── Image Editor state ──
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"avatar" | "cover">("avatar");
  const [editorSaving, setEditorSaving] = useState(false);

  const isOwner = user?.uid === uid;
  const isStaff = isAdmin || isAuthOwner; // admin or platform owner can see private profiles
  
  const [followAnim, setFollowAnim] = useState<"follow" | "unfollow" | null>(null);

  useEffect(() => {
    if (!uid || uid === "undefined" || uid === "null" || uid === "") {
      if (!authLoading && user?.uid) { router.replace(`/u/${user.uid}`); }
      else if (!authLoading) { setLoading(false); }
      return;
    }
    setLoading(true);
    const profileCacheKey = CacheKeys.userProfile(uid);
    const cached = appCache.get<{ user: UserDoc | null; roms: RomItem[] }>(profileCacheKey);
    if (cached && (cached.user || !isOwner)) {
      const resolvedUser = cached.user || (isOwner && authDoc ? authDoc : null);
      setProfile(resolvedUser);
      setRoms(cached.roms);
      if (resolvedUser?.pinnedRomId) {
        const pinned = cached.roms.find((r) => r.id === resolvedUser.pinnedRomId);
        if (pinned) setPinnedRom(pinned);
      }
      if (resolvedUser) {
        setEditForm({
          name: resolvedUser.name || "", bio: resolvedUser.bio || "",
          username: resolvedUser.username || "", pinnedRomId: resolvedUser.pinnedRomId || "",
          github: resolvedUser.github || "", telegram: resolvedUser.telegram || "",
          xda: resolvedUser.xda || "", twitter: resolvedUser.twitter || "",
          website: resolvedUser.website || "", youtube: resolvedUser.youtube || "",
        });
        setEditProfileLinks(buildProfileLinks(resolvedUser));
        setEditChannelLinks(resolvedUser.channelLinks || []);
        setEditDonationLinks(resolvedUser.donationLinks || []);
        setDonationEnabled(resolvedUser.donationEnabled ?? false);
        setEditIncognitoMode(resolvedUser.incognitoMode ?? false);
        setEditHideDownloads(resolvedUser.hideDownloads ?? false);
        setEditHideFollowers(resolvedUser.hideFollowers ?? false);
        setEditPrivateProfile(resolvedUser.privateProfile ?? false);
        setEditHideDownloads(resolvedUser.hideDownloads ?? false);
        setEditHideFollowers(resolvedUser.hideFollowers ?? false);
        setEditPrivateProfile(resolvedUser.privateProfile ?? false);
      }
      setLoading(false);
      return;
    }
    Promise.allSettled([
      apiGetUser(uid),
      apiListRoms({ maintainerUid: uid, max: 24 }),
    ]).then(async ([userResult, romsResult]) => {
      let u = userResult.status === "fulfilled" ? userResult.value : null;
      const romsData = romsResult.status === "fulfilled" ? romsResult.value : { items: [], nextCursor: undefined };
      // Race condition fix: for new accounts the doc may not be created yet — retry once after a short delay
      if (!u && isOwner) {
        await new Promise(r => setTimeout(r, 2000));
        u = await apiGetUser(uid).catch(() => null);
      }
      const resolvedUser = u || (isOwner && authDoc ? authDoc : null);
      // Only cache if we actually found a user (don't cache null so next visit retries)
      if (resolvedUser) {
        appCache.set(profileCacheKey, { user: resolvedUser, roms: romsData.items || [] }, 3 * 60 * 1000);
      }
      setProfile(resolvedUser);
      setRoms(romsData.items || []);
      setNextCursorRoms(romsData.nextCursor || null);
      if (resolvedUser?.pinnedRomId) {
        const pinned = (romsData.items as RomItem[]).find((r) => r.id === resolvedUser.pinnedRomId);
        if (pinned) setPinnedRom(pinned);
      }
      if (resolvedUser) {
        setEditForm({
          name: resolvedUser.name || "", bio: resolvedUser.bio || "",
          username: resolvedUser.username || "", pinnedRomId: resolvedUser.pinnedRomId || "",
          github: resolvedUser.github || "", telegram: resolvedUser.telegram || "",
          xda: resolvedUser.xda || "", twitter: resolvedUser.twitter || "",
          website: resolvedUser.website || "", youtube: resolvedUser.youtube || "",
        });
        setEditProfileLinks(buildProfileLinks(resolvedUser));
        setEditChannelLinks(resolvedUser.channelLinks || []);
        setEditDonationLinks(resolvedUser.donationLinks || []);
        setDonationEnabled(resolvedUser.donationEnabled ?? false);
        setEditIncognitoMode(resolvedUser.incognitoMode ?? false);
      }
    }).finally(() => setLoading(false));
  }, [uid, authLoading, user?.uid, authDoc, isOwner, router]);

  // ── Fetch public platform config (channelLinkMinXP etc.) ──────────
  useEffect(() => {
    // Platform config (channel-link min XP) gates UI affordances. Silent
    // failure = gate uses stale client default (may show/hide wrong button).
    fetch("/api/config")
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { 
        if (cfg?.channelLinkMinXP !== undefined) setChannelLinkMinXP(cfg.channelLinkMinXP);
        if (cfg?.donationMinXP !== undefined) setDonationMinXP(cfg.donationMinXP);
      })
      .catch((err) => logger.error("profile.platformConfig.fetch", err));
  }, []);

  const loadMoreRoms = useCallback(async () => {
    if (!nextCursorRoms || loadingMoreRoms || !uid) return;
    setLoadingMoreRoms(true);
    try {
      const res = await apiListRoms({ maintainerUid: uid, max: 24, cursor: nextCursorRoms });
      setRoms((prev) => [...prev, ...(res?.items ?? [])]);
      setNextCursorRoms(res?.nextCursor || null);
    } catch {} finally { setLoadingMoreRoms(false); }
  }, [nextCursorRoms, loadingMoreRoms, uid]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && nextCursorRoms && !loadingMoreRoms && !loading) {
        loadMoreRoms();
      }
    }, { threshold: 0.1 });
    if (observerTargetRoms.current) observer.observe(observerTargetRoms.current);
    return () => observer.disconnect();
  }, [nextCursorRoms, loadingMoreRoms, loading, loadMoreRoms]);

  useEffect(() => {
    if (user?.uid && uid && user.uid !== uid) {
      apiCheckFollowing(uid).then(setFollowing)
        .catch((err) => logger.error("profile.checkFollowing", err, { uid, viewerUid: user.uid }));
    }
  }, [user?.uid, uid]);

  const handleFollow = useCallback(async () => {
    if (!user?.uid || !uid || followLoading) return;
    setFollowLoading(true);
    setFollowError("");
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setProfile((p) => p ? { ...p, subscribersCount: p.subscribersCount + (wasFollowing ? -1 : 1) } : p);
    try {
      if (wasFollowing) { await apiUnfollow(uid); } else { await apiFollow(uid); }
    } catch {
      setFollowing(wasFollowing);
      setProfile((p) => p ? { ...p, subscribersCount: p.subscribersCount + (wasFollowing ? 1 : -1) } : p);
      setFollowError("Connection failed, try again");
      setTimeout(() => setFollowError(""), 4000);
    } finally { setFollowLoading(false); }
  }, [user?.uid, uid, following, followLoading]);

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    setEditError(""); setSaving(true);
    try {
      // Derive channelLinks from profileLinks (for backward compat on releases)
      const derivedChannelLinks: ChannelLink[] = editProfileLinks
        .filter(l => l.isChannel && l.url.trim())
        .map(l => ({ platform: l.platform as ChannelLink["platform"], url: l.url, label: l.label }));

      const updates: Record<string, unknown> = {
        ...editForm,
        profileLinks: editProfileLinks,
        channelLinks: derivedChannelLinks,
        donationLinks: editDonationLinks,
        donationEnabled,
      };
      // Only include incognitoMode for admin/owner
      if (profile?.role === "admin" || profile?.role === "owner") {
        updates.incognitoMode = editIncognitoMode;
        updates.hideDownloads = editHideDownloads;
        updates.hideFollowers = editHideFollowers;
        updates.privateProfile = editPrivateProfile;
      }
      await apiUpdateProfile(updates);
      // Invalidate profile cache so next visit fetches fresh data
      appCache.invalidate(CacheKeys.userProfile(user.uid));
      // ✅ Fix: sync name to Firebase Auth so it reflects immediately everywhere
      if (editForm.name) {
        await updateFirebaseProfile(editForm.name);
      }
      setProfile((p) => p ? {
        ...p, ...editForm,
        usernameLower: editForm.username.toLowerCase(),
        profileLinks: editProfileLinks,
        channelLinks: derivedChannelLinks,
        donationLinks: editDonationLinks,
        donationEnabled,
        incognitoMode: (p.role === "admin" || p.role === "owner") ? editIncognitoMode : p.incognitoMode,
      } : p);
      if (editForm.pinnedRomId) {
        const pinned = roms.find((r) => r.id === editForm.pinnedRomId);
        setPinnedRom(pinned || null);
      } else { setPinnedRom(null); }
      setEditing(false);
      toast.success(t("profile.saveSuccess"));
    } catch (e: unknown) { setEditError(e instanceof Error ? e.message : "Failed to save"); toast.error(t("profile.saveFailed")); }
    finally { setSaving(false); }
  };

  // Open the ImageEditorModal for avatar
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    e.target.value = "";
    setEditorMode("avatar");
    setEditorSrc(createObjectURL(file));
  };

  // Called by ImageEditorModal after crop+filter
  const handleAvatarSave = async (blob: Blob) => {
    if (!user?.uid) return;
    setEditorSaving(true);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
      fd.append("folder", "romx/avatars");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) {
        await apiUpdateProfile({ photo: data.secure_url });
        // Immediate state update — no refresh needed
        setProfile((p) => p ? { ...p, photo: data.secure_url } : p);
        // Sync to Firebase Auth so navbar updates instantly
        // Sync to Firebase Auth so navbar avatar updates instantly. A silent
        // failure here causes stale avatar in nav until refresh — surface it.
        await updateFirebaseProfile(undefined, data.secure_url)
          .catch((err) => logger.error("profile.syncFirebaseAvatar", err, { uid: user?.uid }));
        toast.success(t("profile.avatarUpdated"));
        setEditorSrc(null);
      } else {
        toast.error(t("profile.avatarFailed"));
      }
    } catch {
      toast.error(t("profile.uploadFailed2"));
    } finally {
      setEditorSaving(false);
      setAvatarUploading(false);
    }
  };

  // Open ImageEditorModal for cover — with XP gate
  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    e.target.value = "";
    // XP gate: Level 7 = 600 XP required for custom cover
    if ((profile?.xp ?? 0) < 600) {
      toast.error(t("profile.coverXpRequired") || "Custom cover requires Level 7 (600 XP). Keep earning!");
      return;
    }
    setEditorMode("cover");
    setEditorSrc(createObjectURL(file));
  };

  // Called by ImageEditorModal after crop+filter (cover)
  const handleCoverSave = async (blob: Blob) => {
    if (!user?.uid) return;
    setEditorSaving(true);
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "cover.jpg");
      fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
      fd.append("folder", "romx/covers");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) {
        await apiUpdateProfile({ coverImage: data.secure_url });
        // Immediate state update
        setProfile((p) => p ? { ...p, coverImage: data.secure_url } : p);
        toast.success("Cover updated!");
        setEditorSrc(null);
      }
    } catch {
      toast.error(t("profile.uploadFailed2"));
    } finally {
      setEditorSaving(false);
      setCoverUploading(false);
    }
  };

  const handleCoverPreset = async (gradient: string) => {
    if (!user?.uid) return;
    const fakeUrl = `__gradient__${encodeURIComponent(gradient)}`;
    // Update profile immediately so coverData reflects new selection right away
    setProfile((p) => p ? { ...p, coverImage: fakeUrl } : p);
    setShowCoverPicker(false);
    try {
      await apiUpdateProfile({ coverImage: fakeUrl });
    } catch {
      toast.error(t("profile.coverSaveFailed"));
      setProfile((p) => p ? { ...p, coverImage: undefined } : p);
    }
  };

  const level = getLevel(profile?.xp);
  const nextLevel = getNextLevel(profile?.xp);
  const showDistinction = (profile?.xp ?? 0) >= 5000;
  const showAdmin = (profile?.role === "admin" || profile?.role === "owner") && !profile?.incognitoMode;

  const hasReleases = roms.length > 0 || (profile?.romsCount ?? 0) > 0;

  useEffect(() => {
    if (!loading && !hasReleases && tab === "roms") {
      // Non-publisher: go to library if own profile, else achievements
      setTab(isOwner ? "library" : "achievements");
    }
  }, [loading, hasReleases, tab, isOwner]);

  const tabList = [
    ...(hasReleases ? [{ id: "roms" as const, label: `${t("profile.releases")} (${roms.length > 0 ? roms.length : (profile?.romsCount ?? 0)})` }] : []),
    ...(isOwner ? [{ id: "library" as const, label: t("profile.library") || "Library" }] : []),
    { id: "achievements" as const, label: t("profile.achievements") },
    ...((isOwner && hasReleases) ? [{ id: "analytics" as const, label: t("profile.analytics") }] : []),
  ];

  if (loading || authLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4">
        {/* Cover skeleton */}
        <div className="relative h-40 sm:h-52 w-full rounded-3xl overflow-hidden mb-2">
          <div className="absolute inset-0 shimmer rounded-3xl" />
          {/* Fake scan line */}
          <div className="absolute inset-x-0 top-0 h-px bg-white/5" />
        </div>

        {/* Profile card skeleton */}
        <div className="rounded-3xl gradient-border bg-card p-4 sm:p-5 card-shadow">
          {/* Avatar + name row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-[68px] w-[68px] sm:h-[76px] sm:w-[76px] rounded-2xl shimmer shrink-0" />
              <div className="space-y-2 pt-1">
                <div className="h-5 w-28 rounded-xl shimmer" />
                <div className="h-3 w-16 rounded-lg shimmer" />
              </div>
            </div>
            <div className="h-9 w-20 rounded-2xl shimmer mt-1" />
          </div>
          {/* Bio */}
          <div className="space-y-2 mb-4 ms-1 border-s-2 border-border ps-3">
            <div className="h-3 w-full rounded-lg shimmer" />
            <div className="h-3 w-3/4 rounded-lg shimmer" />
          </div>
          {/* Followers */}
          <div className="flex items-center gap-5 mb-4 pb-4 border-b border-border/40">
            <div className="space-y-1"><div className="h-4 w-8 rounded shimmer" /><div className="h-2.5 w-14 rounded shimmer" /></div>
            <div className="space-y-1"><div className="h-4 w-6 rounded shimmer" /><div className="h-2.5 w-12 rounded shimmer" /></div>
            <div className="ms-auto h-6 w-24 rounded-full shimmer" />
          </div>
          {/* Bento stats */}
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 py-3">
                <div className="h-4 w-4 rounded-lg shimmer" />
                <div className="h-4 w-8 rounded shimmer" />
                <div className="h-2 w-10 rounded shimmer" />
              </div>
            ))}
          </div>
        </div>

        {/* XP card skeleton */}
        <div className="mt-2 rounded-3xl gradient-border bg-card p-4 card-shadow">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2"><div className="h-4 w-20 rounded-xl shimmer" /><div className="h-4 w-10 rounded-full shimmer" /></div>
              <div className="h-2.5 w-full rounded-full shimmer" />
              <div className="h-2.5 w-32 rounded shimmer" />
            </div>
            <div className="space-y-1 text-end shrink-0"><div className="h-7 w-14 rounded-xl shimmer" /><div className="h-2 w-6 rounded shimmer ms-auto" /></div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="mt-3 rounded-3xl gradient-border bg-card p-1.5 flex gap-1 card-shadow">
          {[...Array(3)].map((_, i) => <div key={i} className={`flex-1 h-9 rounded-2xl shimmer ${i === 0 ? "opacity-100" : "opacity-40"}`} />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    if (!isLoggedIn) return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card mb-5">
          <User className="h-10 w-10 text-muted-foreground/50" />
          <div className="absolute inset-0 rounded-3xl dragon-breathe" style={{ border: "1px solid rgba(29,155,240,0.2)" }} />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">{t("auth.signInPrompt")}</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{t("auth.signInDesc")}</p>
        <button onClick={() => router.push("/login")}
          className="rounded-2xl px-8 py-3 text-sm font-black text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 4px 14px rgba(29,155,240,0.2)" }}>
          {t("auth.signIn")}
        </button>
      </div>
    );
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card mb-5">
          <User className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">{t("profile.userNotFound")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("profile.userNotFoundDesc")}</p>
        <button onClick={() => router.push("/")}
          className="text-sm font-black transition-all hover:scale-105" style={{ color: "var(--primary)" }}>
          {t("common.goHome")}
        </button>
      </div>
    );
  }

  // Private profile — show limited card to non-owners and non-staff
  if (profile.privateProfile && !isOwner && !isStaff) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4">
        <div className="relative rounded-3xl border border-border bg-card overflow-hidden p-8 flex flex-col items-center text-center gap-5">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(29,155,240,0.06) 0%, transparent 60%)" }} />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <EyeOff className="h-9 w-9 text-muted-foreground/60" />
          </div>
          <div className="relative">
            <h2 className="text-xl font-black text-foreground">{profile.name}</h2>
            {profile.username && <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>}
          </div>
          <div className="relative flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground border border-border/50">
            <Lock className="h-3.5 w-3.5" /> {t("profile.isPrivate")}
          </div>
        </div>
      </div>
    );
  }

  const coverData = getCoverStyle(profile?.coverImage);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4">

      {/* ═══════════════════════════════════════��══
          ONE UNIFIED CARD — ROM-page style
      ══════════════════════════════════════════ */}
      <div className="relative rounded-3xl overflow-hidden gradient-border card-shadow-lg animate-in fade-in zoom-in-95 duration-700">

        {/* ── Cover image ── */}
        <div className="relative w-full overflow-hidden" style={{ height: "clamp(160px, 42vw, 260px)" }}>
          {coverData.isGradient ? (
            <div className="absolute inset-0" style={{ background: coverData.gradient }} />
          ) : coverData.url ? (
            <Image src={coverData.url} alt="Cover" fill className="object-cover" crossOrigin="anonymous" priority />
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(29,155,240,0.22) 0%, rgba(139,92,246,0.18) 40%, rgb(var(--card)) 100%)" }}>
              <div className="absolute -top-8 -end-8 h-40 w-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(29,155,240,0.3) 0%, transparent 70%)", filter: "blur(20px)" }} />
              <div className="absolute top-4 -start-8 h-32 w-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)", filter: "blur(18px)" }} />
            </div>
          )}
          {/* Cinematic fade — light foggy dissolve */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: "55%", background: "linear-gradient(to top, rgb(var(--card) / 0.92) 0%, rgb(var(--card) / 0.65) 25%, rgb(var(--card) / 0.35) 55%, rgb(var(--card) / 0.1) 78%, transparent 100%)" }} />

          {/* Owner buttons top-right */}
          {isOwner && (
            <div className="absolute top-3 end-3 flex items-center gap-1.5 z-20">
              <button
                onClick={() => setShowCoverPicker(p => !p)}
                title={t("profile.cover")}
                style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                className="shrink-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-white hover:bg-black/80 transition-all active:scale-90">
                <Star className="h-3.5 w-3.5 text-amber-400" />
              </button>
              <label
                title={t("profile.uploadCover")}
                style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                className="shrink-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-white hover:bg-black/80 transition-all active:scale-90">
                {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverFileSelect} />
              </label>
            </div>
          )}

          {/* Preset picker — fixed so it's never clipped by overflow-hidden */}
          {showCoverPicker && isOwner && (
            <>
              {/* Backdrop to close */}
              <div className="fixed inset-0 z-[90]" onClick={() => setShowCoverPicker(false)} />
              <div className="fixed top-[160px] inset-x-3 z-[91] rounded-2xl border backdrop-blur-xl p-3 shadow-2xl sm:absolute sm:top-14 sm:inset-x-auto sm:end-3 sm:w-72"
                style={{ background: "rgba(10,14,24,0.97)", borderColor: "rgba(255,255,255,0.12)", maxHeight: "55vh", overflowY: "auto" }}
                ref={(el) => {
                  // Scroll to active preset when picker opens
                  if (!el) return;
                  requestAnimationFrame(() => {
                    const active = el.querySelector("[data-active='true']") as HTMLElement;
                    if (active) active.scrollIntoView({ block: "center", behavior: "instant" });
                  });
                }}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-black text-white/80">{t("profile.coverPickerTitle")}</p>
                  <button onClick={() => setShowCoverPicker(false)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white/50 hover:text-white text-xs transition-all">✕</button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {COVER_PRESETS.map((preset) => {
                    const isActive = coverData.gradient === preset.g;
                    return (
                      <button
                        key={preset.label}
                        data-active={isActive ? "true" : "false"}
                        onClick={() => handleCoverPreset(preset.g)}
                        title={preset.label}
                        className={cn("relative h-10 sm:h-12 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 border-2",
                          isActive ? "border-white scale-105" : "border-transparent hover:border-white/40"
                        )} style={{ background: preset.g }}>
                        {isActive && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-black drop-shadow">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-white/25 mt-2 text-center">{t("profile.coverPickerHint")}</p>
              </div>
            </>
          )}
        </div>

        {/* ── Content — avatar on start side ── */}
        <div className="relative px-4 pb-5 pt-0 sm:px-5 z-10">

          {/* Avatar — floats at start, overlapping cover bottom */}
          <div className="flex items-end gap-3 -mt-10 mb-3">
            <div className="relative shrink-0">
              {/* Outer glow ring */}
              <div className="absolute -inset-[3px] rounded-full bg-card" />
              <div className="absolute -inset-2 rounded-full opacity-50"
                style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.6), rgba(99,102,241,0.5))", filter: "blur(8px)" }} />
              {/* Ring border */}
              <div className="absolute -inset-[2px] rounded-full"
                style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.7), rgba(139,92,246,0.5))" }} />
              <Image
                src={safeImg(profile.photo, getDefaultAvatar(profile.name))} alt={profile.name}
                width={88} height={88}
                className="relative rounded-full object-cover"
                style={{ width: 88, height: 88 }}
                crossOrigin="anonymous"
                onError={(e) => { (e.target as HTMLImageElement).src = getDefaultAvatar(profile.name); }}
              />
              {isOwner && (
                <label className={`absolute -bottom-1 -end-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-card border-2 border-[var(--primary)] hover:bg-muted transition-all z-10 shadow-md ${avatarUploading ? "pointer-events-none" : ""}`}>
                  {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--primary)" }} /> : <Camera className="h-3 w-3 text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileSelect} disabled={avatarUploading} />
                </label>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center z-20" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              {showAdmin && (
                <div className="absolute -top-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 ring-2 ring-card z-10">
                  <Shield className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Action button aligned to end */}
            <div className="ms-auto pb-1 flex items-center gap-2">
              {isOwner && !authDoc?.hideOwnerStudioButton && (
                <Link href="/earnings"
                  className="group flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-500 hover:text-white hover:border-cyan-400 transition-all hover:scale-105 active:scale-95 shadow-sm">
                  <BarChart2 className="h-3.5 w-3.5 transition-transform group-hover:scale-110 duration-300" />
                  Studio
                </Link>
              )}
              {isOwner ? (
                <button onClick={() => setEditing(!editing)}
                  className="group flex items-center gap-1.5 rounded-xl border border-border/60 px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-[var(--primary)]/40 transition-all hover:scale-105 active:scale-95">
                  <Settings className="h-3.5 w-3.5 transition-transform group-hover:rotate-90 duration-300" />
                  {t("profile.edit")}
                </button>
              ) : isLoggedIn ? (
                <button onClick={handleFollow} disabled={followLoading}
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all hover:scale-105 active:scale-95 overflow-hidden",
                    following ? "border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive" : "text-white",
                    followLoading && "opacity-60 cursor-not-allowed"
                  )}
                  style={!following ? { background: "linear-gradient(135deg, var(--primary), #6366f1)", boxShadow: "0 3px 12px rgba(29,155,240,0.22)" } : undefined}>
                  {followLoading
                    ? <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {following ? t("profile.following") : t("profile.follow")}
                </button>
              ) : null}
            </div>
          </div>

          {/* Name + badges */}
          <div className="mb-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-foreground leading-tight tracking-tight">{profile.name}</h1>
              {profile.role === "verifiedDev" && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black"
                  style={{ color: "var(--primary)", borderColor: "var(--primary)", backgroundColor: "var(--primary-dim)" }}>
                  ✓ {t("profile.verified")}
                </span>
              )}
              {showDistinction && <DistinctionBadge xp={profile.xp ?? 0} />}
              {profile.privateProfile && isStaff && !isOwner && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                  <EyeOff className="h-2.5 w-2.5" /> {t("profile.hidden")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {profile.username && <p className="text-xs text-muted-foreground/50 font-mono tracking-wide">@{profile.username}</p>}
              {profile.createdAt && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/35">
                  <Calendar className="h-2.5 w-2.5" /> {fmtDate(profile.createdAt)}
                </span>
              )}
            </div>
          </div>

          {/* ── BIO ── */}
          {profile.bio && (
            <p className="text-sm text-muted-foreground/80 leading-relaxed mb-4 ps-3"
              style={{ borderInlineStart: "2px solid var(--primary)", borderImageSlice: 1 }}>
              {profile.bio}
            </p>
          )}



          {/* ── FOLLOWERS / FOLLOWING / XP row ── */}
          <div className="flex items-center gap-6 pb-4 border-b border-border/30 mb-4">
            <Link href={`/u/${uid}/followers`} className="group text-center cursor-pointer">
              <span className="text-base font-black text-foreground group-hover:text-[var(--primary)] transition-colors tabular-nums">{formatCount(profile.subscribersCount)}</span>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold mt-0.5">{t("profile.followers")}</p>
            </Link>
            <div className="w-px h-8 bg-border/40" />
            <Link href={`/u/${uid}/following`} className="group text-center cursor-pointer">
              <span className="text-base font-black text-foreground group-hover:text-[var(--primary)] transition-colors tabular-nums">{formatCount(profile.followingCount ?? 0)}</span>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold mt-0.5">{t("profile.following")}</p>
            </Link>
          </div>

          {/* ── STATS GRID — للناشر فقط ── */}
          {(hasReleases || isOwner) && <div className="grid grid-cols-4 gap-2">
            {(() => {
              // Dynamic aggregation from loaded roms — fixes 0 bug
              const dynDownloads = roms.reduce((s, r) => s + (r.downloads ?? 0), 0);
              const dynViews     = roms.reduce((s, r) => s + (r.total_views ?? 0), 0);
              const dynLikes     = roms.reduce((s, r) => s + (r.likesCount ?? 0), 0);
              return [
                { icon: Package,  value: formatCount(roms.length > 0 ? roms.length : (profile.romsCount ?? 0)), label: t("profile.releases"), color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.18)",  glow: "rgba(56,189,248,0.25)"  },
                { icon: Heart,    value: formatCount(Math.max(profile.totalLikesReceived ?? 0, dynLikes)),       label: t("profile.likes"),     color: "#fb7185", bg: "rgba(251,113,133,0.08)", border: "rgba(251,113,133,0.18)", glow: "rgba(251,113,133,0.25)" },
                { icon: Download, value: formatCount(Math.max(profile.totalDownloads ?? 0, dynDownloads)),       label: t("profile.downloads"), color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.18)",  glow: "rgba(52,211,153,0.25)"  },
                { icon: Eye,      value: formatCount(Math.max(profile.totalViewsReceived ?? 0, dynViews)),       label: t("profile.views"),     color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.18)", glow: "rgba(167,139,250,0.25)" },
              ].map(({ icon: Icon, value, label, color, bg, border, glow }) => (
              <div key={label}
                className="group relative flex flex-col items-center gap-2 rounded-2xl py-3.5 transition-all duration-300 hover:scale-[1.06] cursor-default overflow-hidden"
                style={{ background: bg, border: `1px solid ${border}` }}>
                {/* Hover inner glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }} />
                <div className="relative flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `${color}18` }}>
                  <Icon className="h-4 w-4" style={{ color, filter: `drop-shadow(0 0 4px ${glow})` }} />
                </div>
                <span className="relative text-sm font-black tabular-nums leading-none" style={{ color }}>{value}</span>
                <span className="relative text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50 text-center px-1 leading-none">{label}</span>
              </div>
            ));
            })()}
          </div>}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CHANNEL MODE UNLOCK BANNER — Level 7+
      ══════════════════════════════════════════ */}
      {isOwner && (profile?.xp ?? 0) >= 600 && (
        <div className="mt-2 relative rounded-2xl overflow-hidden border border-[var(--primary)]/20"
          style={{ background: "linear-gradient(135deg, var(--primary-dim) 0%, rgba(99,102,241,0.05) 100%)" }}>
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.5), transparent)" }} />
          <div className="relative flex items-center gap-3 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(29,155,240,0.3)" }}>
              <Zap className="h-5 w-5" style={{ color: "var(--primary)", filter: "drop-shadow(0 0 4px rgba(29,155,240,0.3))" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-foreground leading-tight">{t("profile.channelModeActive")}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t("profile.channelModeDesc")}</p>
            </div>
            <button onClick={() => { setEditing(true); setEditModalTab("links"); }}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-dim)] px-3 py-2 text-xs font-bold transition-all hover:bg-[var(--primary)] hover:text-white hover:scale-105 active:scale-95"
              style={{ color: "var(--primary)" }}>
              <Settings className="h-3.5 w-3.5" /> {t("profile.setupChannel")}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          XP LEVEL CARD — للناشر أو صاحب البروفايل فقط
      ══════════════════════════════════════════ */}
      {(hasReleases || isOwner) && (
        <XpLevelCard xp={profile.xp ?? 0} level={level} nextLevel={nextLevel} isOwner={isOwner} uid={uid} />
      )}



      {/* ══════════════════════════════════════════
          PROFILE LINKS CARD — unified, supports multiple per platform
      ══════════════════════════════════════════ */}
      {(() => {
        const links = buildProfileLinks(profile);
        const canChannel = (profile.xp ?? 0) >= channelLinkMinXP;
        // Filter: if below XP threshold, hide links that are "channel" links
        const visibleLinks = canChannel ? links : links.filter(l => !l.isChannel);
        if (!visibleLinks.length) return null;
        return (
          <div className="mt-2 relative rounded-3xl overflow-hidden gradient-border card-shadow">
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 10%, rgba(29,155,240,0.35) 50%, transparent 90%)" }} />
            <div className="relative p-4" style={{ background: "rgb(var(--card))" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg"
                    style={{ background: "rgba(29,155,240,0.1)", border: "1px solid rgba(29,155,240,0.2)" }}>
                    <Link2 className="h-3 w-3" style={{ color: "var(--primary)" }} />
                  </div>
                  <p className="text-xs font-black text-foreground/80">{t("profile.links")}</p>
                </div>
                {isOwner && (
                  <button onClick={() => { setEditing(true); setEditModalTab("links"); }}
                    className="text-[10px] font-bold transition-colors hover:text-foreground"
                    style={{ color: "var(--primary)" }}>
                    {t("profile.edit")}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleLinks.map((link) => {
                  const pl = LINK_PLATFORMS.find(p => p.id === link.platform);
                  const Icon = pl?.icon ?? Link2;
                  const color = PLATFORM_COLORS[link.platform] ?? "#94a3b8";
                  const url = pl?.prefix && link.url && !link.url.startsWith("http")
                    ? `https://${pl.prefix}${link.url}`
                    : link.url;
                  return (
                    <a key={link.id} href={url} target="_blank" rel="noopener noreferrer"
                      className="group relative flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-xs font-bold transition-all hover:scale-[1.03] active:scale-95 overflow-hidden"
                      style={{ color, background: `${color}0d`, border: `1px solid ${color}28` }}>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}18 0%, transparent 70%)` }} />
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="relative truncate">{link.label}</span>
                      <ExternalLink className="relative h-3 w-3 ms-auto shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}



      {/* ══════════════════════════════════════════
          DONATION LINKS CARD
      ══════════════════════════════════════════ */}
      {(() => {
        const donations = profile.donationLinks ?? [];
        const canDonate = (profile.xp ?? 0) >= donationMinXP;
        if (!donations.length || !canDonate || profile.hideOwnerSupportButton) return null;
        return (
          <div className="mt-2 relative rounded-3xl overflow-hidden gradient-border card-shadow">
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 10%, rgba(251,113,133,0.45) 50%, transparent 90%)" }} />
            <div className="relative p-4" style={{ background: "rgb(var(--card))" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg"
                    style={{ background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)" }}>
                    <Heart className="h-3 w-3 text-rose-400" />
                  </div>
                  <p className="text-xs font-black text-foreground/80">{t("profile.supportDeveloper")}</p>
                </div>
                {isOwner && (
                  <button onClick={() => { setEditing(true); setEditModalTab("donate"); }}
                    className="text-[10px] font-bold transition-colors hover:text-foreground"
                    style={{ color: "var(--primary)" }}>
                    {t("profile.edit")}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {donations.map((link, i) => {
                  const pl = DONATION_PLATFORMS.find(p => p.id === link.platform);
                  const Icon = pl?.icon ?? Heart;
                  const color = pl?.color ?? "#a78bfa";
                  const url = pl?.prefix && link.url && !link.url.startsWith("http")
                    ? `https://${pl.prefix}${link.url}` : link.url;
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="group relative flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-xs font-bold transition-all hover:scale-[1.03] active:scale-95 overflow-hidden"
                      style={{ background: `${color}0d`, border: `1px solid ${color}28`, color }}>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${color}18 0%, transparent 70%)` }} />
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="relative truncate">{link.label}</span>
                      <ExternalLink className="relative h-3 w-3 ms-auto shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}




      {/* ══════════════════════════════════════════
          PINNED ROM — glow pin card
      ══════════════════════════════════════════ */}
      {pinnedRom && (
        <div className="mt-2 relative rounded-3xl border border-[var(--primary)]/20 bg-card overflow-hidden group hover:border-[var(--primary)]/40 transition-all">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--primary-dim) 0%, transparent 60%)" }} />
          <div className="relative flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
              style={{ background: "linear-gradient(135deg, var(--primary-dim), rgba(29,155,240,0.2))", border: "1px solid var(--primary)", boxShadow: "0 0 12px var(--primary-glow)" }}>
              <Pin className="h-4 w-4" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--primary)" }}>📌 Pinned Release</p>
              <p className="text-sm font-black text-foreground truncate">{pinnedRom.name}</p>
            </div>
            <Link href={`/rom/${pinnedRom.id}`}
              className="shrink-0 flex items-center gap-1.5 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-dim)] px-3 py-2 text-xs font-bold transition-all hover:bg-[var(--primary)] hover:text-white hover:scale-105 active:scale-95"
              style={{ color: "var(--primary)" }}>
              View <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Image Editor Modal ── */}
      {editorSrc && isOwner && (
        <ImageEditorModal
          imageSrc={editorSrc}
          mode={editorMode}
          saving={editorSaving}
          onSave={editorMode === "avatar" ? handleAvatarSave : handleCoverSave}
          onClose={() => { setEditorSrc(null); URL.revokeObjectURL(editorSrc); }}
        />
      )}

      {/* ── Edit Profile Modal ── */}
      {editing && isOwner && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setEditing(false)} />

          {/* Modal */}
          <div className="relative z-10 w-full sm:max-w-lg h-[92dvh] sm:h-[88vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
            style={{
              background: "linear-gradient(180deg, var(--profile-card-bg) 0%, rgb(var(--background)) 100%)",
              border: "1px solid var(--profile-card-border)",
              boxShadow: "0 -24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)"
            }}>

            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 10%, rgba(29,155,240,0.7) 50%, transparent 90%)" }} />

            {/* Mobile handle */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden shrink-0">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-0">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(29,155,240,0.3)" }}>
                  <Settings className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
                {t("profile.editProfile")}
              </h3>
              <button onClick={() => setEditing(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 hover:bg-muted/50 hover:border-[var(--primary)]/30 transition-all hover:scale-110 active:scale-90">
                <XIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Tab nav — proper Lucide icons (no emojis) and uniform spacing */}
            <div className="shrink-0 flex gap-1.5 px-4 pt-4 pb-0">
              {([
                { id: "info"    as const, Icon: User,       label: t("profile.modalInfo") },
                { id: "links"   as const, Icon: Link2,      label: t("profile.modalLinks") },
                { id: "donate"  as const, Icon: Heart,      label: t("profile.modalDonate") },
                { id: "privacy" as const, Icon: Settings,   label: t("profile.modalSettings") },
              ]).map((tab) => {
                const TabIcon = tab.Icon;
                const isActive = editModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setEditModalTab(tab.id)}
                    aria-pressed={isActive}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 active:scale-[0.97]"
                    style={isActive ? {
                      background: "linear-gradient(135deg, var(--primary), #3b82f6)",
                      color: "white",
                      boxShadow: "0 4px 12px rgba(29,155,240,0.3)",
                    } : {
                      background: "rgb(var(--muted))",
                      color: "rgb(var(--muted-foreground))",
                      border: "1px solid rgb(var(--border))",
                    }}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {editError && (
              <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">{editError}</div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">

              {/* ═══ TAB 1 — المعلومات ═══ */}
              {editModalTab === "info" && (
                <div className="space-y-2.5">
                  {/* Display name */}
                  <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border/40">
                      <User className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t("profile.displayName")}</span>
                    </div>
                    <input value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder={t("profile.displayNamePlaceholder")}
                      className="w-full h-10 bg-transparent px-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/25 focus:outline-none" />
                  </div>

                  {/* Username */}
                  <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/50 text-xs font-bold">@</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t("profile.usernameLabel")}</span>
                      </div>
                      <span className="text-[9px] rounded-md border border-amber-500/25 bg-amber-500/8 px-1.5 py-0.5 text-amber-400/70">{t("profile.usernameCooldown")}</span>
                    </div>
                    <input value={editForm.username}
                      onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder="your_username"
                      className="w-full h-10 bg-transparent px-3.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/25 focus:outline-none" />
                  </div>

                  {/* Bio */}
                  <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border/40">
                      <FileText className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t("profile.bioLabel")}</span>
                      <span className="ms-auto text-[10px] text-muted-foreground/35">{editForm.bio?.length ?? 0}/160</span>
                    </div>
                    <textarea value={editForm.bio}
                      onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                      rows={3} maxLength={160}
                      placeholder={t("profile.bioPlaceholder")}
                      className="w-full bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none resize-none" />
                  </div>

                  {/* Pinned ROM */}
                  <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border/40">
                      <Pin className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t("profile.pinnedRom")}</span>
                      {(profile?.xp ?? 0) < 150 && (
                        <span className="ms-auto text-[9px] rounded-md border border-blue-500/25 bg-blue-500/8 px-1.5 py-0.5 text-blue-400/70">🔒 150 XP</span>
                      )}
                    </div>
                    {(profile?.xp ?? 0) >= 150 ? (
                      <select value={editForm.pinnedRomId}
                        onChange={(e) => setEditForm((p) => ({ ...p, pinnedRomId: e.target.value }))}
                        className="w-full h-10 bg-transparent px-3.5 text-sm text-foreground focus:outline-none appearance-none cursor-pointer">
                        <option value="">{t("profile.pinnedRomSelect")}</option>
                        {roms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (
                      <div className="px-3.5 py-2.5 text-xs text-muted-foreground/50">
                        {t("profile.pinnedRomCollectXP")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ TAB 2 — الروابط ═══ */}
              {editModalTab === "links" && (
                <EditSocialLinks
                  profileLinks={editProfileLinks}
                  setProfileLinks={setEditProfileLinks}
                />
              )}

              {/* ═���═ TAB 3 — التبرع ═══ */}
              {editModalTab === "donate" && (
                <EditDonationLinks
                  donationLinks={editDonationLinks}
                  setDonationLinks={setEditDonationLinks}
                />
              )}

              {/* ═══ TAB: الإعدادات ═══ */}
              {editModalTab === "privacy" && (() => {
                const isPublisher = (profile?.romsCount ?? 0) > 0 || (profile?.xp ?? 0) >= 150;
                const isStaffMember = profile?.role === "admin" || profile?.role === "owner";
                return (
                  <div className="space-y-3">

                    {/* ── للجميع ──────────────────────────────────── */}
                    <p className="text-[10px] font-black uppercase tracking-widest px-1"
                      style={{ color: "rgba(255,255,255,0.25)" }}>عام</p>

                    <PrivacyToggle icon="👥" label={t("privacy.hideFollowers")}
                      val={editHideFollowers} set={setEditHideFollowers} color="#a78bfa" />
                    <PrivacyToggle icon="🔒" label={t("privacy.privateProfile")} desc={t("privacy.privateProfileDesc")}
                      val={editPrivateProfile} set={setEditPrivateProfile} color="#fb7185" />

                    {/* ── للناشر/المطور فقط ───────────────────────── */}
                    {isPublisher && (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest px-1 pt-1"
                          style={{ color: "rgba(29,155,240,0.7)" }}>⚡ للناشر</p>

                        <PrivacyToggle icon="⬇️" label={t("privacy.hideDownloads")}
                          desc={t("privacy.hideDownloadsDesc") || "Hide download count from visitors"}
                          val={editHideDownloads} set={setEditHideDownloads} color="#60a5fa" />
                      </>
                    )}

                    {/* ── للأدمن ف��ط ──────────────────────────────── */}
                    {isStaffMember && (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest px-1 pt-1"
                          style={{ color: "rgba(99,102,241,0.7)" }}>🛡 Staff Only</p>
                        <PrivacyToggle icon="🕵️" label={t("privacy.incognito")} desc={t("privacy.incognitoDesc")}
                          val={editIncognitoMode} set={setEditIncognitoMode} color="#6366f1" />
                      </>
                    )}

                  {/* Delete-account flow — owns its own state; no parent coupling */}
                  <DeleteAccountSection isOwner={isOwner} />

                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 pt-3 flex items-center gap-3"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(16px)",
              }}>
              <button onClick={() => setEditing(false)}
                className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "rgb(var(--muted))", border: "1px solid rgb(var(--border))", color: "rgb(var(--foreground) / 0.7)" }}>
                {t("profile.cancel")}
              </button>
              <button onClick={handleSaveProfile} disabled={saving}
                className="relative flex-[2] flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 overflow-hidden"
                style={{ background: "linear-gradient(135deg, #1d9bf0, #0ea5e9)", boxShadow: "0 4px 16px rgba(29,155,240,0.35)" }}>
                <span className="absolute inset-0 translate-x-[-150%] hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("profile.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MARKETPLACE — provider profile + active listings
      ══════════════════════════════════════════ */}
      {uid && <UserMarketplaceSection uid={uid} isOwner={isOwner} />}

      {/* ══════════════════════════════════════════
          TABS — pill switcher
      ══════════════════════════════════════════ */}
      <div className="mt-4 relative flex items-center gap-1 rounded-2xl border border-border/50 bg-card p-1.5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-700">
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.2), transparent)" }} />
        {tabList.map((tabItem) => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={cn(
              "relative flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-300 overflow-hidden hover:scale-[1.02] active:scale-[0.97]",
              tab === tabItem.id
                ? "text-white shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={tab === tabItem.id ? {
              background: "linear-gradient(135deg, var(--primary), #3b82f6)",
              boxShadow: "0 4px 16px rgba(29,155,240,0.35)"
            } : undefined}>
            {tab === tabItem.id && (
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}
            {tabItem.id === "analytics" && <BarChart2 className="h-3.5 w-3.5 shrink-0" />}
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="mt-2 pb-20">
        {tab === "roms" && (
          <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 stagger-children">
            {roms.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
                  <Package className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">{t("profile.noReleases")}</p>
              </div>
            ) : roms.map((r, i) => (
              <div key={r.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
                <RomCard rom={r} />
              </div>
            ))}
          </div>
          {nextCursorRoms && (
            <div ref={observerTargetRoms} className="flex justify-center py-4 mt-2">
              {loadingMoreRoms && (
                <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.loading") || "Loading..."}
                </div>
              )}
            </div>
          )}
          </>
        )}

        {tab === "achievements" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(profile.achievements?.length || 0) === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
                  <Award className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">{t("profile.noAchievements")}</p>
              </div>
            ) : profile.achievements?.map((achId, i) => {
              const ach = ACHIEVEMENTS[achId];
              if (!ach) return null;
              return (
                <div key={achId} className="group relative flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 overflow-hidden hover:border-[var(--primary)]/30 hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
                  {/* Background glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 0% 50%, rgba(29,155,240,0.05) 0%, transparent 70%)" }} />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-muted shrink-0 group-hover:scale-110 transition-transform"
                    style={{ boxShadow: "0 0 12px rgba(29,155,240,0.1)" }}>
                    <Award className="h-5 w-5 transition-all" style={{ color: "var(--primary)", filter: "drop-shadow(0 0 3px rgba(29,155,240,0.25))" }} />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <p className="text-sm font-black text-foreground leading-tight">{ach.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ach.desc}</p>
                  </div>
                  <span className="relative shrink-0 text-xs font-black rounded-full px-2 py-1"
                    style={{ color: "var(--primary)", backgroundColor: "var(--primary-dim)", border: "1px solid var(--primary)" }}>
                    +{ach.xp} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "analytics" && isOwner && <AnalyticsTab profile={profile} />}

        {/* ══════════════════════════════════════════
            LIBRARY TAB — للمستخدم: Favorites + Collections
        ══════════════════════════════════════════ */}
        {tab === "library" && isOwner && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-400">

            {libraryLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
              </div>
            )}

            {!libraryLoading && (
              <>
                {/* ── Favorites ──────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-400" />
                      <p className="text-sm font-black text-foreground">{t("profile.favorites") || "Favorites"}</p>
                      {likedRoms.length > 0 && (
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                          style={{ background: "rgba(251,113,133,0.1)", color: "#fb7185", border: "1px solid rgba(251,113,133,0.2)" }}>
                          {likedRoms.length}
                        </span>
                      )}
                    </div>
                    <Link href="/favorites"
                      className="text-[10px] font-bold transition-colors hover:text-[var(--primary)]"
                      style={{ color: "rgba(255,255,255,0.35)" }}>
                      {t("profile.viewAll") || "View All ←"}
                    </Link>
                  </div>

                  {likedRoms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-border/40 bg-card/30 text-center gap-2">
                      <Heart className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground/50">{t("profile.noFavorites") || "No favorites yet"}</p>
                      <Link href="/explore"
                        className="text-xs font-bold rounded-xl px-3 py-1.5 mt-1 transition-all hover:scale-105"
                        style={{ background: "rgba(29,155,240,0.1)", color: "var(--primary)", border: "1px solid rgba(29,155,240,0.2)" }}>
                        {t("profile.exploreRoms") || "Explore ROMs"}
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                      {likedRoms.map((r, i) => (
                        <div key={r.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
                          <RomCard rom={r} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Collections ────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-violet-400" />
                      <p className="text-sm font-black text-foreground">{t("profile.collections") || "Collections"}</p>
                      {collections.length > 0 && (
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                          style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                          {collections.length}
                        </span>
                      )}
                    </div>
                    <Link href="/collections"
                      className="text-[10px] font-bold transition-colors hover:text-[var(--primary)]"
                      style={{ color: "rgba(255,255,255,0.35)" }}>
                      عرض الكل ���
                    </Link>
                  </div>

                  {collections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-border/40 bg-card/30 text-center gap-2">
                      <Layers className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground/50">{t("profile.noCollections") || "No collections yet"}</p>
                      <Link href="/collections"
                        className="text-xs font-bold rounded-xl px-3 py-1.5 mt-1 transition-all hover:scale-105"
                        style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                        {t("profile.startCollection") || "Start Collection"}
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
                      {collections.map((col, i) => (
                        <Link key={col.id} href={`/collections/${col.id}`}
                          className="group flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/40 p-3 transition-all hover:border-violet-500/30 hover:bg-card/60 hover:scale-[1.02] animate-in fade-in duration-300"
                          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
                          {col.thumbnail ? (
                            <div className="relative h-16 rounded-xl overflow-hidden bg-muted">
                              <Image src={col.thumbnail} alt={col.name} fill className="object-cover" crossOrigin="anonymous" />
                            </div>
                          ) : (
                            <div className="h-16 rounded-xl flex items-center justify-center"
                              style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
                              <Layers className="h-6 w-6 text-violet-400/50" />
                            </div>
                          )}
                          <p className="text-xs font-black text-foreground truncate">{col.name}</p>
                          <p className="text-[10px] text-muted-foreground/50">{col.romsCount ?? 0} {t("profile.romCount") || "ROMs"}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
