import { NextRequest } from "next/server";
import {
  jsonResponse, errorResponse,
  getClientIp, hashIp,
  rateLimit, rateLimitUserOrIp, rateLimitedResponse,
} from "@/lib/api/middleware";
import { romSchema } from "@/lib/api/schemas";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { XP_REWARDS } from "@/lib/constants";
import { writeActivity } from "@/lib/server/feed";
import { sendNotif } from "@/lib/server/notifications";
import { checkAndAwardAchievements } from "@/lib/server/achievements";
import { sbAdmin } from "@/lib/supabase/admin";
import { resolveDevice, recordDeviceVote, cleanCodename } from "@/lib/server/smart-device-engine";
import { romCreated } from "@/lib/server/sync";
import { awardXP, deductXP, notifyDeviceWatchers } from "../utils";
import { logger } from "@/lib/logger";

export async function handlePost(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`post:${ip}`, 30, 60_000)) return rateLimitedResponse(req);

  try {
    const body = await req.json();
    const { action } = body;

    // Toggle Like — atomic via RPC (scripts/904). Previously a read-then-write
    // on `likes_count` that lost increments under concurrent likes.
    // Supports both authenticated users (tracked by UID) and anonymous users
    // (tracked by IP fingerprint in `anon_likes_dedup` — no forced login).
    if (action === "toggleLike") {
      const user = await verifyRequest(req).catch(() => null);
      const { romId } = body;
      if (!romId) return errorResponse("Missing romId", 400, req);

      // ── Anonymous like path ───────────────────────────────────────────────
      if (!user) {
        if (!(await rateLimit(`anon:like:${hashIp(ip)}`, 20, 60_000))) return rateLimitedResponse(req);
        const anonDedupId = `anon_${hashIp(ip)}_${romId}`;
        const { data: anonExisting } = await sbAdmin
          .from("anon_likes_dedup").select("id").eq("id", anonDedupId).maybeSingle();
        if (anonExisting) {
          await sbAdmin.from("anon_likes_dedup").delete().eq("id", anonDedupId);
          await sbAdmin.rpc("decrement_rom_likes", { p_rom_id: romId });
          return jsonResponse({ liked: false, anonymous: true }, 200, req);
        }
        await sbAdmin.from("anon_likes_dedup").insert({
          id: anonDedupId, rom_id: romId, created_at: new Date().toISOString(),
        });
        await sbAdmin.rpc("increment_rom_likes", { p_rom_id: romId });
        return jsonResponse({ liked: true, anonymous: true }, 200, req);
      }

      // ── Authenticated like path ───────────────────────────────────────────
      // Dual rate limit: per-uid tight, per-ip loose. Prevents one user spamming
      // toggleLike across IPs and one IP spinning up many throwaway accounts.
      if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 30, perIp: 120, scope: "rom:like" }))) {
        return rateLimitedResponse(req);
      }

      const { data: existing } = await sbAdmin.from("likes").select("rom_id")
        .eq("rom_id", romId).eq("user_id", user.uid).maybeSingle();

      // We still need maintainer_uid + name for notifications — but NOT
      // likes_count, because the RPC mutates it atomically.
      const { data: romRow } = await sbAdmin.from("roms")
        .select("maintainer_uid, name").eq("id", romId).single();
      const rom = romRow as Record<string, unknown> | null;

      if (existing) {
        await sbAdmin.from("likes").delete().eq("rom_id", romId).eq("user_id", user.uid);
        await sbAdmin.rpc("decrement_rom_likes", { p_rom_id: romId });
        if (rom?.maintainer_uid && rom.maintainer_uid !== user.uid) {
          deductXP(rom.maintainer_uid as string, XP_REWARDS.LIKE_RECEIVED);
        }
        return jsonResponse({ liked: false }, 200, req);
      }

      await sbAdmin.from("likes").insert({ rom_id: romId, user_id: user.uid });
      await sbAdmin.rpc("increment_rom_likes", { p_rom_id: romId });

      if (rom?.maintainer_uid && rom.maintainer_uid !== user.uid) {
        awardXP(rom.maintainer_uid as string, XP_REWARDS.LIKE_RECEIVED, "LIKE_RECEIVED");
        void sbAdmin.from("users").select("name,photo").eq("id", user.uid).single().then(({ data: actorData }) => {
          const actor = actorData as Record<string, unknown> | null;
          sendNotif({
            recipientUid: rom.maintainer_uid as string,
            type: "like",
            title: `❤️ ${actor?.name || "شخص ما"} أعجبه ${rom.name || "ROM بتاعك"}`,
            body: "تابع نشاطك لترى كل التفاعلات",
            link: `/rom/${romId}`,
            authorPhoto: (actor?.photo as string) || "",
            dedupKey: `like_${romId}_${user.uid}`,
          });
        }).then(undefined, (err) => logger.warn("roms.toggleLike.notifyFailed", { err: String(err), romId }));
        checkAndAwardAchievements(rom.maintainer_uid as string).catch((err) =>
          logger.warn("roms.toggleLike.achievementsFailed", { err: String(err), uid: rom.maintainer_uid })
        );
      }
      return jsonResponse({ liked: true }, 200, req);
    }

    // Download — supports both authenticated and anonymous users.
    // Authenticated: deduped by user UID (most accurate, persists across IPs).
    // Anonymous: deduped by hashed(IP + User-Agent) fingerprint for a better
    //   signal than IP alone (shared NAT / proxies won't over-suppress downloads).
    if (action === "download") {
      const { romId } = body;
      if (!romId) return errorResponse("Missing romId", 400, req);
      const user = await verifyRequest(req).catch(() => null);
      // Build a fingerprint that combines IP + User-Agent for anonymous users
      // so that multiple people behind the same NAT are counted separately.
      const ua = req.headers.get("user-agent") || "";
      const anonFingerprint = hashIp(ip + ":" + ua.slice(0, 120));
      const dedupId = user ? `user_${user.uid}_${romId}` : `ip_${anonFingerprint}_${romId}`;

      const { data: dd } = await sbAdmin.from("downloads_dedup").select("last_at").eq("id", dedupId).maybeSingle();
      if (dd) {
        const lastMs = new Date((dd as Record<string, unknown>).last_at as string).getTime();
        if (Date.now() - lastMs < 24 * 60 * 60_000) return jsonResponse({ success: true, deduplicated: true }, 200, req);
      }

      await sbAdmin.from("downloads_dedup").upsert({ id: dedupId, rom_id: romId, last_at: new Date().toISOString() });

      // Atomic increment via RPC; returns the new downloads value so we can
      // still fire milestone notifications (100/500/1000) without a re-read.
      const { data: newDlData } = await sbAdmin.rpc("increment_rom_downloads", { p_rom_id: romId });
      const newDl = typeof newDlData === "number" ? newDlData : 0;

      // Fetch the static fields (maintainer/name) we still need for notifs/XP.
      const { data: romRow } = await sbAdmin.from("roms")
        .select("maintainer_uid, name").eq("id", romId).single();
      const rom = romRow as Record<string, unknown> | null;

      const todayDl = new Date().toISOString().split("T")[0];
      void sbAdmin.rpc("increment_daily_stat", {
        p_rom_id: romId,
        p_maintainer_uid: (rom?.maintainer_uid as string) || "",
        p_stat_date: todayDl,
        p_views: 0,
        p_downloads: 1,
      }).then(() => {}, () => {});

      if (rom?.maintainer_uid) {
        const uid = rom.maintainer_uid as string;
        if (newDl % 10 === 0) awardXP(uid, XP_REWARDS.DOWNLOADS_PER_10, "DOWNLOADS_PER_10");
        for (const [ms, xp, flag] of [[100, XP_REWARDS.MILESTONE_100_DL, "milestone_100_awarded"],
          [500, XP_REWARDS.MILESTONE_500_DL, "milestone_500_awarded"], [1000, 100, "milestone_1000_awarded"]] as [number, number, string][]) {
          if (newDl === ms) {
            awardXP(uid, xp);
            await sbAdmin.from("roms").update({ [flag]: true }).eq("id", romId);
            sendNotif({ recipientUid: uid, type: `milestone_${ms}` as never,
              title: `🎉 ${rom.name} وصل ${ms} تحميل!`,
              body: `حصلت على +${xp} XP مكافأة.`,
              link: `/rom/${romId}`, dedupKey: `milestone_${ms}_${romId}` })
              .catch((err) => logger.error("roms.post.download.milestoneNotif", err, { uid, romId, ms }));
          }
        }
        checkAndAwardAchievements(uid)
          .catch((err) => logger.error("roms.post.download.achievements", err, { uid, romId }));
      }
      return jsonResponse({ success: true }, 200, req);
    }

    // View
    if (action === "view") {
      const { romId } = body;
      if (!romId) return errorResponse("Missing romId", 400, req);
      const dedupId = `${hashIp(ip)}_${romId}`;
      const { data: vd } = await sbAdmin.from("views_dedup").select("last_at").eq("id", dedupId).maybeSingle();
      if (vd) {
        const lastMs = new Date((vd as Record<string, unknown>).last_at as string).getTime();
        if (Date.now() - lastMs < 30 * 60_000) return jsonResponse({ success: true, deduplicated: true }, 200, req);
      }
      await sbAdmin.from("views_dedup").upsert({ id: dedupId, rom_id: romId, last_at: new Date().toISOString() });

      // Atomic increment; returns the new total_views. `prevViews` is simply
      // `newViews - 1`, which keeps milestone boundary checks below accurate.
      const { data: newViewsData } = await sbAdmin.rpc("increment_rom_views", { p_rom_id: romId });
      const newViews = typeof newViewsData === "number" ? newViewsData : 0;
      const prevViews = Math.max(0, newViews - 1);

      const { data: rv } = await sbAdmin.from("roms").select("maintainer_uid").eq("id", romId).single();
      const maintUid = (rv as Record<string, unknown> | null)?.maintainer_uid as string || "";

      // ── XP: كل 100 مشاهدة فريدة → 1 XP للمطور ─────────────────────
      if (maintUid && Math.floor(newViews / 100) > Math.floor(prevViews / 100)) {
        awardXP(maintUid, XP_REWARDS.VIEWS_PER_100, "VIEWS_PER_100");
      }
      // ── Milestone notifications: 1k / 10k / 100k views ───────────────
      if (maintUid) {
        const milestones = [1000, 10000, 100000];
        for (const ms of milestones) {
          if (newViews >= ms && prevViews < ms) {
            const { sendNotif } = await import("@/lib/server/notifications");
            sendNotif({
              recipientUid: maintUid,
              type: "milestone_100",
              title: `👁️ وصلت ${ms.toLocaleString()} مشاهدة!`,
              body: "منشورك يكبر — استمر!",
              link: `/rom/${romId}`,
              dedupKey: `views_milestone_${romId}_${ms}`,
            }).catch((err) => logger.error("roms.post.view.milestoneNotif", err, { maintUid, romId, ms }));
          }
        }
      }

      const todayView = new Date().toISOString().split("T")[0];
      if (maintUid) {
        void sbAdmin.rpc("increment_daily_stat", {
          p_rom_id: romId,
          p_maintainer_uid: maintUid,
          p_stat_date: todayView,
          p_views: 1,
          p_downloads: 0,
        }).then(() => {}, () => {});

        // ── Increment totalViewsReceived on Supabase user doc ─────────
        void sbAdmin.rpc("increment_user_views_received", { p_user_id: maintUid }).then(undefined, () => {});


        // ── Check view-based achievements every 100 views ──────────────
        if (newViews % 100 === 0) {
          const { checkAndAwardAchievements } = await import("@/lib/server/achievements");
          checkAndAwardAchievements(maintUid)
            .catch((err) => logger.error("roms.post.view.achievements", err, { maintUid, romId }));
        }
      }
      return jsonResponse({ success: true }, 200, req);
    }

    // Rate — the single most dangerous pre-fix race. Two users rating the same
    // ROM concurrently could corrupt rating_avg permanently (rating_sum drifts
    // out of sync with rating_count). The `upsert_rom_rating` RPC does the
    // upsert + delta + avg recompute under a `SELECT FOR UPDATE` row lock.
    if (action === "rate") {
      const user = await verifyRequest(req);
      if (!user) return errorResponse("Unauthorized", 401, req);
      if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 20, perIp: 60, scope: "rom:rate" }))) {
        return rateLimitedResponse(req);
      }
      const { romId, score } = body;
      if (!romId || score < 1 || score > 5) return errorResponse("Invalid rating", 400, req);

      const { data: romRow } = await sbAdmin.from("roms").select("maintainer_uid").eq("id", romId).single();
      if (!romRow) return errorResponse("ROM not found", 404, req);
      const rom = romRow as Record<string, unknown>;

      if (rom.maintainer_uid !== user.uid) {
        const { data: dl } = await sbAdmin.from("downloads_dedup").select("id")
          .eq("id", `user_${user.uid}_${romId}`).maybeSingle();
        if (!dl) return errorResponse("يجب تحميل الـ ROM أولاً", 403, req);
      }

      const { error: rateErr } = await sbAdmin.rpc("upsert_rom_rating", {
        p_rom_id:  romId,
        p_user_id: user.uid,
        p_score:   score,
      });
      if (rateErr) return errorResponse(rateErr.message, 500, req);

      return jsonResponse({ success: true }, 200, req);
    }

    // Create ROM
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);
    if (user.banned) return errorResponse("Account banned", 403, req);

    const parsed = romSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Validation: ${parsed.error.issues.map((i) => i.message).join(", ")}`, 400, req);
    }

    if (parsed.data.downloadUrl) {
      const { data: existing } = await sbAdmin
        .from("roms")
        .select("id, name, maintainer_uid")
        .eq("download_url", parsed.data.downloadUrl)
        .maybeSingle();

      if (existing && (existing as Record<string, unknown>).id) {
        const dup = existing as Record<string, unknown>;
        const isSameUser = dup.maintainer_uid === user.uid;
        return errorResponse(
          isSameUser
            ? `نشرت هذا الرابط بالفعل في إصدار آخر: "${dup.name}"`
            : `هذا الرابط موجود بالفعل في إصدار آخر. إذا كنت أنت صاحب الإصدار الأصلي، تواصل مع الإدارة.`,
          409,
          req
        );
      }
    }
    const data = parsed.data;
    const { data: ud } = await sbAdmin.from("users").select("name,photo,linkvertise_global_enabled").eq("id", user.uid).single();
    const u = ud as Record<string, unknown> | null;

    // إذا المطور فعّل الـ global toggle، نطبّق Linkvertise تلقائياً على أي منشور جديد
    // إلا لو صرّح بالعكس في نموذج النشر
    const globalLvEnabled = (u?.linkvertise_global_enabled as boolean) ?? false;

    const VALID_SB_ROLES = ["user", "verifiedDev", "admin", "moderator", "banned"];
    let userName = (u?.name as string) || "";
    let userPhoto = (u?.photo as string) || "";

    if (!u) {
      userName = user.name || "User";
      userPhoto = user.picture || "";
      const sbRole = "user";

      await sbAdmin.from("users").upsert({
        id: user.uid,
        name: userName,
        email: user.email || "",
        photo: userPhoto,
        role: sbRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }

    const ext = data as Record<string, unknown>;
    const { data: newRom, error: ie } = await sbAdmin.from("roms").insert({
      name: data.name, content_type: data.contentType, brand: data.brand || "Generic",
      device: data.device || (data.contentType === "gsi" ? "Universal" : "Unknown"), android: data.android || "", version: data.version || "",
      size: data.size || "", description: data.description || "", changelog: data.changelog || "",
      download_url: data.downloadUrl || "", mirror_url: data.mirrorUrl || "",
      thumbnail: data.thumbnail || "", screenshots: data.screenshots || [],
      tags: data.tags || [], rom_status: data.romStatus || "active",
      rom_type: data.romType || "", install_guide: data.installGuide || "",
      checksum_md5: data.checksumMd5 || "", checksum_sha256: data.checksumSha256 || "",
      kernel_version: data.kernelVersion || "", recovery_type: data.recoveryType || "",
      module_id: data.moduleId || "", min_magisk: data.minMagisk || "",
      module_manager: data.moduleManager || "any", variants: data.variants || [],
      compatible_devices: data.compatibleDevices || [], mirrors: data.mirrors || [],
      trend_score: 100,
      kernel_type:       (ext.kernelType as string) || "",
      anykernel_targets: (ext.anyKernelTargets as string) || "",
      module_scope:      (ext.moduleScope as string) || "",
      module_managers:   (ext.moduleManagers as string[]) || ["any"],
      treble_type:       (ext.trebleType as string) || "",
      gsi_arch:          (ext.gsiArch as string) || "",
      gsi_type:          (ext.gsiType as string) || "",
      soc_family:        (ext.socFamily as string) || "",
      xda_url:           (ext.xdaUrl as string) || "",
      telegram_url:      (ext.telegramUrl as string) || "",
      source_url:        (ext.sourceUrl as string) || "",
      known_issues:      (ext.knownIssues as string) || "",
      min_ram:           (ext.minRam as string) || "",
      min_storage:       (ext.minStorage as string) || "",
      linkvertise_enabled: (ext.linkvertiseEnabled as boolean) ?? globalLvEnabled,
      device_codename: (() => {
        const raw        = ((data as Record<string,unknown>).deviceCodename as string || "").trim();
        const deviceName = (data.device || "").trim();
        if (raw) return cleanCodename(raw);
        return cleanCodename(deviceName || "unknown");
      })(),
      maintainer_uid: user.uid, maintainer_name: userName, maintainer_photo: userPhoto,
    }).select().single();

    if (ie) return errorResponse(ie.message, 500, req);
    const romId = (newRom as Record<string, unknown>).id as string;

    const savedCodename = (newRom as Record<string, unknown>).device_codename as string || "";
    recordDeviceVote(
      romId,
      data.device || "",
      data.brand  || "",
      (data as Record<string, unknown>).deviceCodename as string || savedCodename,
      user.uid,
    ).catch((err) => logger.error("roms.post.create.recordDeviceVote", err, { romId, uid: user.uid }));

    if (savedCodename && data.device) {
      import("@/lib/server/device-ingestion")
        .then(m => m.autoIngestDevice(savedCodename, String(data.device || ""), String(data.brand || "")))
        .catch((err) => logger.error("roms.post.create.autoIngestDevice", err, { codename: savedCodename }));
    }

    const deviceImage = (data as Record<string, unknown>).deviceImage as string || "";
    if (deviceImage && savedCodename) {
      void sbAdmin.from("devices").upsert({
        codename:          savedCodename,
        image_url:         deviceImage,
        image_source:      "manual",
        image_verified_at: new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      }, { onConflict: "codename", ignoreDuplicates: false }).then(() => {}, () => {});
    }

    const { data: currentUser } = await sbAdmin.from("users").select("roms_count").eq("id", user.uid).single();
    await sbAdmin.from("users").update({
      roms_count: ((currentUser as Record<string, unknown> | null)?.roms_count as number || 0) + 1
    }).eq("id", user.uid);

    awardXP(user.uid, XP_REWARDS.ROM_PUBLISH, "ROM_PUBLISH");
    checkAndAwardAchievements(user.uid)
      .catch((err) => logger.error("roms.post.create.achievements", err, { uid: user.uid, romId }));
    writeActivity({ uid: user.uid, username: u?.name as string || "",
      photo: u?.photo as string || "", type: "new_rom", romId, romName: data.name || "" })
      .catch((err) => logger.error("roms.post.create.writeActivity", err, { uid: user.uid, romId }));

  try {
    const { invalidateDevicesCache } = await import("@/lib/server/devices-cache");
    invalidateDevicesCache();
  } catch (err) {
    // Cache miss is tolerable; log to spot repeated failures.
    logger.warn("roms.post.cacheInvalidateFailed", { err: String(err) });
  }

    void romCreated(data.contentType as string);
    notifyDeviceWatchers(romId, data.device || "", data.compatibleDevices || [], data.name || "", user.uid)
      .catch((err) => logger.error("roms.post.create.notifyDeviceWatchers", err, { romId }));

    return jsonResponse({ id: romId }, 201, req);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500, req);
  }
}
