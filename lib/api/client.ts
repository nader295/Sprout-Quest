import { auth } from "@/lib/firebase/client";
import type {
  RomItem, UserDoc, Comment, Reply, ContentType, SortOption,
  NotificationItem, Collection, DeveloperApplication, Report,
  AdminLogEntry, MigrationInfo,
} from "@/lib/types";

// ── Helpers ────────────────────────────────────────────

// ✅ Token cache — يتجنب getIdToken() (network call) على كل request
let _cachedToken: string | null = null;
let _tokenExpiry = 0;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 دقيقة (token صالح ساعة)

// ── Auth-ready gate ────────────────────────────────────
// يمنع أي request يحتاج token من الإرسال قبل ما onAuthStateChanged يرد
// بيحل مشكلة الـ 401 اللي بتحصل لما Firebase تاخد وقت أطول من 2 ثانية
let _authReady = false;
let _authReadyResolve: (() => void) | null = null;
const _authReadyPromise = new Promise<void>((res) => { _authReadyResolve = res; });
const AUTH_GATE_TIMEOUT_MS = 6000; // نفس timeout الـ use-auth.tsx

if (typeof window !== "undefined") {
  import("@/lib/firebase/client").then(({ auth: firebaseAuth }) => {
    firebaseAuth.onAuthStateChanged((user) => {
      if (!user) { _cachedToken = null; _tokenExpiry = 0; }
      // أول ما onAuthStateChanged يرد (بغض النظر logged in أو لأ) → gate تفتح
      if (!_authReady) {
        _authReady = true;
        _authReadyResolve?.();
      }
    });
  }).catch(() => {
    // لو Firebase مش شغال خالص، افتح الـ gate عشان ما تتعطلش الـ requests
    if (!_authReady) { _authReady = true; _authReadyResolve?.(); }
  });

  // Safety: افتح الـ gate بعد 6 ثوان في أسوأ حالة
  setTimeout(() => {
    if (!_authReady) { _authReady = true; _authReadyResolve?.(); }
  }, AUTH_GATE_TIMEOUT_MS);
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // انتظر ما Firebase يحدد الـ auth state — بيمنع إرسال request بدون token
  if (!_authReady) {
    await Promise.race([
      _authReadyPromise,
      new Promise<void>((r) => setTimeout(r, AUTH_GATE_TIMEOUT_MS)),
    ]);
  }

  const user = auth.currentUser;
  if (!user) return {};
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiry) {
    return { Authorization: `Bearer ${_cachedToken}` };
  }
  const token = await user.getIdToken();
  _cachedToken = token;
  _tokenExpiry = now + TOKEN_TTL_MS;
  return { Authorization: `Bearer ${token}` };
}

// Request deduplication — نفس الـ URL في نفس الوقت = request واحد بس
const _inflight = new Map<string, Promise<unknown>>();

// Structured API error for consistent handling
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FETCH_TIMEOUT_MS = 15_000; // 15s network timeout

async function apiFetch<T>(url: string, opts: RequestInit = {}, retries = 2): Promise<T> {
  // Dedup GET requests only
  const isGet = !opts.method || opts.method === "GET";
  if (isGet && _inflight.has(url)) return _inflight.get(url) as Promise<T>;

  const doFetch = async (): Promise<T> => {
    const authHeaders = await getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        ...opts,
        signal: opts.signal ?? controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...opts.headers,
        },
      });
    } catch (err: unknown) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      throw new ApiError(
        isTimeout ? "Request timed out. Check your connection." : "Network error. Check your connection.",
        isTimeout ? 408 : 0,
        isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Retry تلقائي على 429 و503 مع exponential backoff
    if ((res.status === 429 || res.status === 503) && retries > 0) {
      const retryAfter = Number(res.headers.get("Retry-After") || 0);
      const delay = retryAfter ? retryAfter * 1000 : (3 - retries) * 1500;
      await new Promise((r) => setTimeout(r, delay));
      return apiFetch<T>(url, opts, retries - 1);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        body.error || `Request failed (${res.status})`,
        res.status,
        body.code,
      );
    }
    return res.json() as Promise<T>;
  };

  const promise = doFetch();
  if (isGet) {
    _inflight.set(url, promise);
    promise.finally(() => _inflight.delete(url));
  }
  return promise;
}

// ── ROMs ───────────────────────────────────────────────

export async function apiListRoms(params: {
  max?: number; // Default 20 — keeps pages fast
  sortBy?: SortOption;
  contentType?: ContentType;
  brand?: string;
  android?: string;
  status?: string;
  cursor?: string;
  device?: string;
  maintainerUid?: string;
  featured?: boolean;
  ids?: string[];
  query?: string;
} = {}): Promise<{ items: RomItem[]; nextCursor: string | null }> {
  const sp = new URLSearchParams();
  if (params.max) sp.set("max", String(params.max));
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.contentType) sp.set("contentType", params.contentType);
  if (params.brand) sp.set("brand", params.brand);
  if (params.android) sp.set("android", params.android);
  if (params.status) sp.set("status", params.status);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.device) sp.set("device", params.device);
  if (params.maintainerUid) sp.set("maintainerUid", params.maintainerUid);
  if (params.featured) sp.set("featured", "true");
  if (params.ids?.length) sp.set("ids", params.ids.join(","));
  if (params.query) sp.set("q", params.query);
  return apiFetch(`/api/roms?${sp.toString()}`);
}

export async function apiGetRom(id: string): Promise<RomItem | null> {
  try {
    return await apiFetch<RomItem>(`/api/roms?id=${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function apiCreateRom(data: Record<string, unknown>): Promise<{ id: string }> {
  return apiFetch("/api/roms", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateRom(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch("/api/roms", { method: "PUT", body: JSON.stringify({ id, ...data }) });
}

export async function apiGetDeleteXPPreview(id: string): Promise<{
  total: number;
  breakdown: Record<string, number>;
}> {
  return apiFetch(`/api/roms?xpPreview=${encodeURIComponent(id)}`);
}

export async function apiDeleteRom(id: string): Promise<void> {
  await apiFetch(`/api/roms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiToggleLike(romId: string): Promise<{ liked: boolean }> {
  return apiFetch("/api/roms", { method: "POST", body: JSON.stringify({ action: "toggleLike", romId }) });
}

export async function apiCheckLiked(romId: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ liked: boolean }>(`/api/roms?action=checkLiked&romId=${encodeURIComponent(romId)}`);
    return res.liked;
  } catch {
    return false;
  }
}

export async function apiRecordDownload(romId: string): Promise<void> {
  await apiFetch("/api/roms", { method: "POST", body: JSON.stringify({ action: "download", romId }) }).catch(() => {});
}

export async function apiIncrementViews(romId: string): Promise<void> {
  await apiFetch("/api/roms", { method: "POST", body: JSON.stringify({ action: "view", romId }) }).catch(() => {});
}

export async function apiSetRating(romId: string, score: number): Promise<void> {
  await apiFetch("/api/roms", { method: "POST", body: JSON.stringify({ action: "rate", romId, score }) });
}

export async function apiGetRating(romId: string): Promise<number> {
  try {
    const res = await apiFetch<{ score: number }>(`/api/roms?action=getRating&romId=${encodeURIComponent(romId)}`);
    return res.score;
  } catch {
    return 0;
  }
}

// ── Users ──────────────────────────────────────────────

/**
 * Batch fetch multiple users in one request.
 * Use this instead of multiple apiGetUser() calls.
 */
export async function apiGetUsersBatch(uids: string[]): Promise<Record<string, UserDoc>> {
  if (uids.length === 0) return {};
  const params = new URLSearchParams();
  uids.slice(0, 20).forEach((uid) => params.append("uids", uid)); // max 20
  const data = await apiFetch<{ users: UserDoc[] }>(`/api/users?${params}`);
  return Object.fromEntries(data.users.map((u) => [u.id || u.uid, u]));
}

export async function apiGetUser(uid: string, bypassCache = false): Promise<UserDoc | null> {
  try {
    const url = `/api/users?id=${encodeURIComponent(uid)}${bypassCache ? `&_t=${Date.now()}` : ""}`;
    return await apiFetch<UserDoc>(url);
  } catch {
    return null;
  }
}

export async function apiGetUserByUsername(username: string): Promise<UserDoc | null> {
  try {
    return await apiFetch<UserDoc>(`/api/users?username=${encodeURIComponent(username)}`);
  } catch {
    return null;
  }
}

export async function apiSearchUsers(q: string, max = 10): Promise<UserDoc[]> {
  if (!q || q.length < 2) return [];
  const res = await apiFetch<{ items: UserDoc[] }>(`/api/users?search=${encodeURIComponent(q)}&max=${max}`);
  return res.items;
}

export async function apiGetLeaderboard(by = "xp", max = 20): Promise<UserDoc[]> {
  const res = await apiFetch<{ items: UserDoc[] }>(`/api/users?by=${encodeURIComponent(by)}&max=${max}`);
  return res.items;
}

export async function apiUpdateProfile(data: Record<string, unknown>): Promise<void> {
  await apiFetch("/api/users", { method: "PUT", body: JSON.stringify(data) });
}

export async function apiEnsureUser(userData: {
  uid: string;
  name: string;
  email: string;
  photo: string;
  country?: string;
  countryName?: string;
  showOnMap?: boolean;
}): Promise<UserDoc> {
  return apiFetch("/api/users", { method: "POST", body: JSON.stringify({ action: "ensure", ...userData }) });
}

export async function apiCheckUsername(username: string, uid?: string): Promise<{ available: boolean }> {
  const sp = new URLSearchParams({ action: "checkUsername", username });
  if (uid) sp.set("uid", uid);
  return apiFetch(`/api/users?${sp.toString()}`);
}

export async function apiBlockUser(targetUid: string): Promise<void> {
  await apiFetch("/api/users", { method: "POST", body: JSON.stringify({ action: "block", targetUid }) });
}

export async function apiUnblockUser(targetUid: string): Promise<void> {
  await apiFetch("/api/users", { method: "POST", body: JSON.stringify({ action: "unblock", targetUid }) });
}

// ── Follow ─────────────────────────────────────────────

export async function apiFollow(targetUid: string): Promise<void> {
  await apiFetch("/api/follow", { method: "POST", body: JSON.stringify({ targetUid, action: "follow" }) });
}

export async function apiUnfollow(targetUid: string): Promise<void> {
  await apiFetch("/api/follow", { method: "POST", body: JSON.stringify({ targetUid, action: "unfollow" }) });
}

export async function apiCheckFollowing(targetUid: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ following: boolean }>(`/api/follow?action=isFollowing&uid=${encodeURIComponent(targetUid)}`);
    return res.following;
  } catch {
    return false;
  }
}

export async function apiGetFollowingList(max = 50): Promise<string[]> {
  const res = await apiFetch<{ items: string[] }>(`/api/follow?action=list&max=${max}`);
  return res.items;
}

// ── Comments ───────────────────────────────────────────

export async function apiListComments(romId: string): Promise<Comment[]> {
  const res = await apiFetch<{ items: Comment[] }>(`/api/comments?romId=${encodeURIComponent(romId)}`);
  return res.items;
}

export async function apiListReplies(romId: string, commentId: string): Promise<Reply[]> {
  const res = await apiFetch<{ items: Reply[] }>(`/api/comments?romId=${encodeURIComponent(romId)}&commentId=${encodeURIComponent(commentId)}`);
  return res.items;
}

export async function apiAddComment(romId: string, text: string, parentId?: string): Promise<{ id: string }> {
  return apiFetch("/api/comments", { method: "POST", body: JSON.stringify({ romId, text, parentId }) });
}

export async function apiDeleteComment(romId: string, commentId: string): Promise<void> {
  await apiFetch(`/api/comments?romId=${encodeURIComponent(romId)}&commentId=${encodeURIComponent(commentId)}`, { method: "DELETE" });
}

export async function apiEditComment(romId: string, commentId: string, text: string): Promise<void> {
  await apiFetch("/api/comments", { method: "PATCH", body: JSON.stringify({ romId, commentId, text }) });
}

export async function apiToggleCommentLike(romId: string, commentId: string): Promise<{ liked: boolean }> {
  return apiFetch("/api/comments", { method: "POST", body: JSON.stringify({ romId, commentId, action: "toggleLike" }) });
}

export async function apiCheckCommentLiked(romId: string, commentId: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ liked: boolean }>(`/api/comments?romId=${encodeURIComponent(romId)}&commentId=${encodeURIComponent(commentId)}&action=checkLiked`);
    return res.liked;
  } catch {
    return false;
  }
}

export async function apiTogglePinComment(romId: string, commentId: string): Promise<void> {
  await apiFetch("/api/comments", { method: "POST", body: JSON.stringify({ romId, commentId, action: "togglePin" }) });
}

// ── Reports ────────────────────────────────────────────

export async function apiSubmitReport(data: Record<string, unknown>): Promise<{ id: string }> {
  return apiFetch("/api/reports", { method: "POST", body: JSON.stringify(data) });
}

export async function apiListReports(status = "pending"): Promise<Report[]> {
  const res = await apiFetch<{ items: Report[] }>(`/api/reports?status=${encodeURIComponent(status)}`);
  return res.items;
}

export async function apiResolveReport(id: string, note?: string): Promise<void> {
  await apiFetch("/api/reports", { method: "PUT", body: JSON.stringify({ id, status: "resolved", adminNote: note }) });
}

// ── Stats ──────────────────────────────────────────────

export async function apiGetStats(): Promise<{
  totalRoms: number;
  totalUsers: number;
  totalDevs: number;
  onlineCount: number;
  totalKernels?: number;
  totalModules?: number;
  totalRecoveries?: number;
}> {
  return apiFetch("/api/stats");
}

// ── Presence ───────────────────────────────────────────

export async function apiUpdatePresence(anon = false): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const hasAuth = !!authHeaders.Authorization;

  if (hasAuth) {
    // Authenticated user - send with token
    await apiFetch("/api/presence", { method: "POST" }).catch(() => {});
  } else if (anon) {
    // Anonymous user - send { anon: true } without auth header
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anon: true }),
    }).catch(() => {});
  }
}

export async function apiGetOnlineCount(): Promise<number> {
  try {
    const res = await apiFetch<{ count: number }>("/api/presence");
    return res.count;
  } catch {
    return 0;
  }
}

// ── Notifications ──────────────────────────────────────

export async function apiListNotifications(): Promise<NotificationItem[]> {
  const res = await apiFetch<{ items: NotificationItem[] }>("/api/notifications");
  return res.items;
}

export async function apiMarkNotificationsRead(): Promise<void> {
  await apiFetch("/api/notifications", { method: "PUT" });
}

export async function apiMarkNotificationRead(notificationId: string): Promise<void> {
  await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ notificationId }) });
}

// ── Collections ────────────────────────────────────────

export async function apiListCollections(): Promise<Collection[]> {
  const res = await apiFetch<{ items: Collection[] }>("/api/collections");
  return res.items;
}

export async function apiGetCollection(id: string): Promise<Collection | null> {
  try {
    return await apiFetch<Collection>(`/api/collections?id=${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function apiCreateCollection(data: { name: string; description?: string; isPublic?: boolean }): Promise<{ id: string }> {
  return apiFetch("/api/collections", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateCollection(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch("/api/collections", { method: "PUT", body: JSON.stringify({ id, ...data }) });
}

export async function apiDeleteCollection(id: string): Promise<void> {
  await apiFetch(`/api/collections?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiAddToCollection(collectionId: string, romId: string): Promise<void> {
  await apiFetch("/api/collections", { method: "POST", body: JSON.stringify({ action: "addRom", collectionId, romId }) });
}

export async function apiRemoveFromCollection(collectionId: string, romId: string): Promise<void> {
  await apiFetch("/api/collections", { method: "POST", body: JSON.stringify({ action: "removeRom", collectionId, romId }) });
}

// ── Applications ───────────────────────────────────────

export async function apiSubmitApplication(data: Record<string, unknown>): Promise<{ id: string }> {
  return apiFetch("/api/applications", { method: "POST", body: JSON.stringify(data) });
}

export async function apiGetMyApplication(): Promise<DeveloperApplication | null> {
  try {
    return await apiFetch<DeveloperApplication>("/api/applications?mine=true");
  } catch {
    return null;
  }
}

// ── Admin ──────────────────────────────────────────────

export async function apiAdminListUsers(max = 50): Promise<UserDoc[]> {
  const res = await apiFetch<{ items: UserDoc[] }>(`/api/admin?action=listUsers&max=${max}`);
  return res.items;
}

export async function apiAdminSetRole(uid: string, role: string): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "setRole", uid, role }) });
}

export async function apiAdminBanUser(uid: string, ban = true): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "ban", uid, ban }) });
}

export async function apiAdminListApplications(status = "pending"): Promise<DeveloperApplication[]> {
  const res = await apiFetch<{ items: DeveloperApplication[] }>(`/api/admin?action=listApplications&status=${encodeURIComponent(status)}`);
  return res.items;
}

export async function apiAdminHandleApplication(id: string, status: "approved" | "rejected", note?: string): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "handleApplication", id, status, note }) });
}

export async function apiAdminDeleteRom(id: string): Promise<void> {
  await apiFetch(`/api/roms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiAdminSetFeatured(romId: string, featured: boolean): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "setFeatured", romId, featured }) });
}

export async function apiAdminGetDashboardStats(): Promise<Record<string, unknown>> {
  return apiFetch("/api/admin?action=dashboardStats");
}

// ── Admin Logs ─────────────────────────────────────────

export async function apiAdminListLogs(params: {
  level?: string;
  category?: string;
  limit?: number;
} = {}): Promise<AdminLogEntry[]> {
  const sp = new URLSearchParams();
  if (params.level) sp.set("level", params.level);
  if (params.category) sp.set("category", params.category);
  if (params.limit) sp.set("limit", String(params.limit));
  const res = await apiFetch<{ items: AdminLogEntry[] }>(`/api/admin/logs?${sp.toString()}`);
  return res.items;
}

export async function apiAdminAddLog(data: Record<string, unknown>): Promise<{ id: string }> {
  return apiFetch("/api/admin/logs", { method: "POST", body: JSON.stringify(data) });
}

export async function apiAdminDeleteLog(id: string): Promise<void> {
  await apiFetch(`/api/admin/logs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiAdminClearLogs(): Promise<void> {
  await apiFetch("/api/admin/logs", { method: "DELETE" });
}

// ── Appeals ────────────────────────────────────────────

import type { Appeal } from "@/lib/types";

export async function apiSubmitAppeal(data: { explanation: string; evidenceUrl?: string }): Promise<{ id: string }> {
  return apiFetch("/api/appeals", { method: "POST", body: JSON.stringify(data) });
}

export async function apiGetMyAppeal(): Promise<Appeal | null> {
  try {
    return await apiFetch<Appeal>("/api/appeals?mine=true");
  } catch {
    return null;
  }
}

export async function apiAdminListAppeals(status = "pending"): Promise<Appeal[]> {
  const res = await apiFetch<{ items: Appeal[] }>(`/api/appeals?status=${encodeURIComponent(status)}`);
  return res.items;
}

export async function apiAdminHandleAppeal(id: string, status: "approved" | "rejected", note?: string): Promise<void> {
  await apiFetch("/api/appeals", { method: "PUT", body: JSON.stringify({ id, status, adminNote: note }) });
}

// ── Enhanced Moderation ────────────────────────────────

export async function apiMarkReportValid(id: string, note?: string): Promise<void> {
  await apiFetch("/api/reports", { method: "PUT", body: JSON.stringify({ id, status: "valid", adminNote: note }) });
}

export async function apiMarkReportInvalid(id: string, note?: string): Promise<void> {
  await apiFetch("/api/reports", { method: "PUT", body: JSON.stringify({ id, status: "invalid", adminNote: note }) });
}

export async function apiAdminSuspendUser(uid: string, durationMs: number, reason: string): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "suspend", uid, durationMs, reason }) });
}

export async function apiAdminUnsuspendUser(uid: string): Promise<void> {
  await apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "unsuspend", uid }) });
}

// ── Featured Developers ────────────────────────────────

export async function apiGetFeaturedDevelopers(max = 10): Promise<UserDoc[]> {
  const res = await apiFetch<{ items: UserDoc[] }>(`/api/users?featured=true&max=${max}`);
  return res.items;
}

// ── Follow List with Data ──────────────────────────────

export async function apiGetFollowersList(uid: string, max = 50): Promise<UserDoc[]> {
  try {
    const res = await apiFetch<{ items: UserDoc[] }>(`/api/follow?action=followers&uid=${encodeURIComponent(uid)}&max=${max}`);
    return Array.isArray(res?.items) ? res.items : [];
  } catch { return []; }
}

export async function apiGetFollowingListWithData(uid: string, max = 50): Promise<UserDoc[]> {
  try {
    const res = await apiFetch<{ items: UserDoc[] }>(`/api/follow?action=followingData&uid=${encodeURIComponent(uid)}&max=${max}`);
    return Array.isArray(res?.items) ? res.items : [];
  } catch { return []; }
}

// ── Developer Analytics ────────────────────────────────

export async function apiGetDeveloperAnalytics(): Promise<{
  totalViews: number;
  totalDownloads: number;
  totalLikes: number;
  totalAdSupports: number;
  adSupportEarnings: number;
  viewsByDay: { date: string; views: number }[];
  downloadsByDay: { date: string; downloads: number }[];
  topRoms: { id: string; name: string; views: number; downloads: number }[];
}> {
  return apiFetch("/api/users?action=analytics");
}

// ── Migrations ──────────────────────────────────────────────────
// MigrationInfo is defined in lib/types.ts
export async function apiListMigrations(): Promise<{ migrations: MigrationInfo[] }> {
  return apiFetch("/api/admin/migrations");
}

export async function apiRunMigration(migrationId: string): Promise<{
  ok: boolean;
  affected: number;
  duration: number;
  details: string[];
  error?: string;
}> {
  return apiFetch("/api/admin/migrations", {
    method: "POST",
    body: JSON.stringify({ migrationId }),
  });
}

// ── Enhanced Admin ──────────────────────────────────────────────
export async function apiAdminAdjustXP(uid: string, amount: number, reason?: string): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "adjustXP", uid, amount, reason }) });
}
export async function apiAdminResetXP(uid: string): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "resetXP", uid }) });
}
export async function apiAdminHealthStats(): Promise<{ suspended: number; banned: number; pendingAppeals: number; totalRoms: number; totalUsers: number; totalXp: number }> {
  return apiFetch("/api/admin?action=healthStats");
}
export async function apiAdminRecentActivity(): Promise<{ recentRoms: { id: string; name: string; device: string; maintainerName: string; createdAt: string | null }[]; recentUsers: { id: string; name: string; username: string; email: string; photo: string; createdAt: string | null }[]; recentReports: { id: string; targetType: string; reason: string; reporterName: string; createdAt: string | null }[] }> {
  return apiFetch("/api/admin?action=recentActivity");
}
export async function apiAdminBulkResolveReports(ids: string[], resolution: "valid" | "invalid"): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "bulkResolveReports", ids, resolution }) });
}
export async function apiAdminWipeResolvedReports(): Promise<{ deleted: number }> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "wipeResolvedReports" }) });
}
export async function apiAdminBroadcast(title: string, message: string, link?: string): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "broadcast", title, message, link }) });
}
export async function apiAdminDeleteRomById(romId: string): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "deleteRom", romId }) });
}

// ── ROM Versions ────────────────────────────────────────────────
export async function apiGetRomVersions(romId: string): Promise<import("@/lib/types").RomVersion[]> {
  try {
    const res = await apiFetch<{ items: import("@/lib/types").RomVersion[] }>(`/api/roms/versions?romId=${encodeURIComponent(romId)}`);
    return res.items;
  } catch {
    return [];
  }
}

// ── Support / Monetization (Primo v5) ────────────────────────────────────
export async function apiSupportRom(romId: string): Promise<{ success: boolean; alreadySupported?: boolean; newCount?: number }> {
  return apiFetch("/api/roms/support", { method: "POST", body: JSON.stringify({ romId }) });
}

export async function apiAdSupportRom(romId: string, watchSeconds: number): Promise<{
  success: boolean;
  dailyRemaining?: number;
  devTotal?: number;
  pointsEarned?: number;
  devEarning?: number;
  cooldown?: boolean;
  remainMin?: number;
  remainMs?: number;
  dailyLimitReached?: boolean;
  postLimitReached?: boolean;
  error?: string;
}> {
  return apiFetch("/api/roms/ad-support", {
    method: "POST",
    body: JSON.stringify({ romId, watchSeconds }),
  });
}

export async function apiGetAdSupportStats(): Promise<{
  totalPlatformAdSupports: number;
  totalPlatformRevenue: number;
  topEarners: { uid: string; name: string; totalAdSupports: number; earnings: number }[];
}> {
  return apiFetch("/api/admin?action=adSupportStats");
}

export async function apiGetAdConfig(): Promise<import("@/lib/types").AdConfig> {
  return apiFetch("/api/admin?action=getAdConfig");
}

export async function apiUpdateAdConfig(config: import("@/lib/types").AdConfig): Promise<void> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "updateAdConfig", config }) });
}

export async function apiGetEarnings(): Promise<{
  totalDownloads: number;
  totalSupports: number;
  totalViews: number;
  estimatedEarnings: number;
  dailyStats: { date: string; downloads: number; views: number; supports: number }[];
}> {
  try {
    return await apiFetch("/api/stats?scope=earnings");
  } catch {
    return { totalDownloads: 0, totalSupports: 0, totalViews: 0, estimatedEarnings: 0, dailyStats: [] };
  }
}

// ── Payout System ──────────────────────────────────────────────────

/** Developer: get available balance for withdrawal */
export async function apiGetPayoutBalance(): Promise<{
  adSupportEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawal: number;
  availableBalance: number;
  totalAdSupports: number;
}> {
  return apiFetch("/api/payouts?action=balance");
}

/** Developer: request a payout withdrawal */
export async function apiRequestPayout(data: {
  amount: number;
  paymentMethod: import("@/lib/types").PaymentMethod;
  walletAddress: string;
}): Promise<{ id: string; status: string; autoApproved?: boolean }> {
  return apiFetch("/api/payouts", { method: "POST", body: JSON.stringify(data) });
}

/** Developer: get their own payout history */
export async function apiGetMyPayouts(): Promise<import("@/lib/types").PayoutRequest[]> {
  const res = await apiFetch<{ items: import("@/lib/types").PayoutRequest[] }>("/api/payouts?action=myHistory");
  return res.items;
}

/** Admin: list all payout requests with optional status filter */
export async function apiAdminListPayouts(status?: string): Promise<import("@/lib/types").PayoutRequest[]> {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  const res = await apiFetch<{ items: import("@/lib/types").PayoutRequest[] }>(`/api/payouts?action=adminList&${sp.toString()}`);
  return res.items;
}

/** Admin: handle a payout request (approve/reject/pay/hold/fail) */
export async function apiAdminHandlePayout(data: {
  id: string;
  status: import("@/lib/types").PayoutStatus;
  adminNote?: string;
  adjustedAmount?: number;
  txHash?: string;
}): Promise<{ ok: boolean }> {
  return apiFetch("/api/payouts", { method: "PUT", body: JSON.stringify(data) });
}

/** Admin: batch approve all trusted developer payouts */
export async function apiAdminBatchApproveTrusted(): Promise<{ approved: number }> {
  return apiFetch("/api/payouts", { method: "POST", body: JSON.stringify({ action: "batchApproveTrusted" }) });
}

/** Admin: batch mark all approved payouts as paid */
export async function apiAdminBatchMarkPaid(txHash: string): Promise<{ paid: number }> {
  return apiFetch("/api/payouts", { method: "POST", body: JSON.stringify({ action: "batchMarkPaid", txHash }) });
}

/** Admin: export approved payouts as CSV for mass Binance transfer */
export async function apiAdminExportPayoutsCSV(): Promise<string> {
  const authHeaders = await (async () => {
    const { auth } = await import("@/lib/firebase/client");
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  })();
  const res = await fetch("/api/payouts?action=exportCSV", { headers: authHeaders as Record<string, string> });
  return res.text();
}

/** Owner: get the revenue vault (unclaimed platform share + claim history) */
export async function apiOwnerGetRevenueVault(): Promise<{
  unclaimedPlatformShare: number;
  totalClaimed: number;
  totalAdViews: number;
  claims: import("@/lib/types").OwnerClaim[];
}> {
  return apiFetch("/api/admin?action=getOwnerVault");
}

/** Owner: claim all unclaimed platform revenue (resets counter to 0) */
export async function apiOwnerClaimRevenue(note?: string): Promise<{ claimed: number }> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "claimOwnerRevenue", note }) });
}

/** Owner: input actual monthly revenue from ad networks for pro-rata settlement */
export async function apiOwnerSettleMonth(data: {
  month: string;
  actualRevenue: number;
  note?: string;
}): Promise<{ settled: number; devPayouts: { uid: string; name: string; views: number; share: number; amount: number }[] }> {
  return apiFetch("/api/admin", { method: "POST", body: JSON.stringify({ action: "settleMonth", ...data }) });
}

// ── Linkvertise ───────────────────────────────────────────────────────

/** تسجيل نقرة Linkvertise لمنشور محدد */
export async function apiTrackLinkvertiseClick(romId: string): Promise<void> {
  try {
    await apiFetch("/api/linkvertise", {
      method: "POST",
      body: JSON.stringify({ romId }),
    });
  } catch { /* non-critical */ }
}

/** تفعيل/إيقاف Linkvertise على منشور واحد */
export async function apiToggleLinkvertise(romId: string, enabled: boolean): Promise<{ success: boolean }> {
  return apiFetch("/api/linkvertise", {
    method: "POST",
    body: JSON.stringify({ action: "toggle", romId, enabled }),
  });
}

/** تفعيل/إيقاف Linkvertise على كل المنشورات */
export async function apiToggleLinkvertiseAll(enabled: boolean): Promise<{ success: boolean }> {
  return apiFetch("/api/linkvertise", {
    method: "POST",
    body: JSON.stringify({ action: "toggleAll", enabled }),
  });
}

/** جلب ملخص أرباح Linkvertise للمطور الحالي */
export async function apiGetLinkvertiseStats(uid?: string): Promise<{
  publisherId: string;
  globalEnabled: boolean;
  earnings: { gross: number; net: number; platform: number; currency: string };
  clicks: { total: number; today: number; month: number };
  lastSync: string | null;
  syncError: string | null;
}> {
  const q = uid ? `?uid=${uid}` : "";
  return apiFetch(`/api/linkvertise${q}`);
}

// ── Upload Provider API Keys ─────────────────────────────────────────────

export type UploadProvider = "pixeldrain";
export type UploadKeyStatus = "active" | "exhausted" | "invalid" | "disabled";

export interface UploadApiKey {
  id: string;
  provider: UploadProvider;
  label: string;
  fingerprint: string;
  status: UploadKeyStatus;
  priority: number;
  uploadsCount: number;
  bytesUploaded: number;
  lastUsedAt: string | null;
  exhaustedAt: string | null;
  exhaustedReason: string | null;
  lastError: string | null;
  createdAt: string;
}

export async function apiListUploadKeys(provider?: UploadProvider): Promise<UploadApiKey[]> {
  const q = provider ? `?provider=${provider}` : "";
  const res = await apiFetch<{ items: UploadApiKey[] }>(`/api/user/api-keys${q}`);
  return res.items;
}

export async function apiCreateUploadKey(input: {
  provider: UploadProvider;
  key: string;
  label?: string;
  priority?: number;
}): Promise<UploadApiKey> {
  const res = await apiFetch<{ item: UploadApiKey }>("/api/user/api-keys", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
  return res.item;
}

export async function apiUpdateUploadKey(input: {
  id: string;
  label?: string;
  priority?: number;
  status?: UploadKeyStatus;
  key?: string;
}): Promise<UploadApiKey> {
  const res = await apiFetch<{ item: UploadApiKey }>("/api/user/api-keys", {
    method: "POST",
    body: JSON.stringify({ action: "update", ...input }),
  });
  return res.item;
}

export async function apiDeleteUploadKey(id: string): Promise<void> {
  await apiFetch("/api/user/api-keys", {
    method: "POST",
    body: JSON.stringify({ action: "delete", id }),
  });
}

export async function apiTestUploadKey(id: string): Promise<{ ok: boolean; reason: string | null }> {
  return apiFetch("/api/user/api-keys", {
    method: "POST",
    body: JSON.stringify({ action: "test", id }),
  });
}

// ── Pixeldrain Upload Flow ──────────────────────────────────────────────

export interface PixeldrainTicket {
  ok: true;
  ticket: string;
  keyId: string;
  fingerprint: string;
  label: string;
  maskedKey: string;
  apiKey: string;
  uploadUrl: string;
  authHeader: string;
}
export interface PixeldrainTicketUnavailable {
  ok: false;
  code: "NO_ACTIVE_KEY";
  error: string;
}

export async function apiPixeldrainTicket(
  fileName: string,
  fileSize: number,
): Promise<PixeldrainTicket | PixeldrainTicketUnavailable> {
  const sp = new URLSearchParams({ action: "ticket", fileName, fileSize: String(fileSize) });
  return apiFetch(`/api/upload/pixeldrain?${sp.toString()}`);
}

export async function apiPixeldrainComplete(input: {
  ticket: string;
  success: boolean;
  fileId?: string;
  errorStatus?: number;
  errorBody?: string;
}): Promise<{
  ok: boolean;
  url?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  rotated?: boolean;
  newKeyId?: string | null;
  status?: "exhausted" | "invalid" | null;
  reason?: string;
}> {
  return apiFetch("/api/upload/pixeldrain", {
    method: "POST",
    body: JSON.stringify({ action: "complete", ...input }),
  });
}
