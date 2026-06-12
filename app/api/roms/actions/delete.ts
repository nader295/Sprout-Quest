import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { romCleanup, romDeleted } from "@/lib/server/sync";
import { logger } from "@/lib/logger";

export async function handleDelete(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`del:${ip}`, 10, 60_000)) return rateLimitedResponse(req);
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return errorResponse("Missing id", 400, req);

  const { data: romRow } = await sbAdmin
    .from("roms")
    .select("maintainer_uid, thumbnail, screenshots, content_type, likes_count, downloads, total_views, milestone_100_awarded, milestone_500_awarded, milestone_1000_awarded")
    .eq("id", id)
    .single();
  if (!romRow) return errorResponse("Not found", 404, req);
  const rom = romRow as Record<string, unknown>;

  if (rom.maintainer_uid !== user.uid && !isAdmin(user)) return errorResponse("Forbidden", 403, req);

  // حذف من Supabase بالتوازي
  // Side-table deletes are wrapped so the main ROM row delete always succeeds
  // even if a cascade fails — but failures are surfaced to Sentry so zombie
  // rows (orphan versions/comments/ratings) don't accumulate invisibly.
  await Promise.all([
    sbAdmin.from("roms").delete().eq("id", id),
    Promise.resolve(sbAdmin.from("roms_versions").delete().eq("rom_id", id))
      .catch((err) => logger.error("roms.delete.versions", err, { romId: id })),
    Promise.resolve(sbAdmin.from("comments").delete().eq("rom_id", id))
      .catch((err) => logger.error("roms.delete.comments", err, { romId: id })),
    Promise.resolve(sbAdmin.from("ratings").delete().eq("rom_id", id))
      .catch((err) => logger.error("roms.delete.ratings", err, { romId: id })),
  ]);

  const { data: ud } = await sbAdmin.from("users").select("roms_count").eq("id", rom.maintainer_uid as string).single();
  await sbAdmin.from("users")
    .update({ roms_count: Math.max(0, ((ud as Record<string, unknown> | null)?.roms_count as number || 1) - 1) })
    .eq("id", rom.maintainer_uid as string);

  import("@/lib/server/xp").then(async ({ computeRomXP, deductXP }) => {
    // Count unique commenters from Supabase
    const { count: uniqueCommenters } = await sbAdmin
      .from("xp_comments_dedup")
      .select("*", { count: "exact", head: true })
      .eq("rom_id", id);

    const { total } = computeRomXP({
      contentType:      rom.content_type as string,
      likesCount:       (rom.likes_count   as number) ?? 0,
      downloads:        (rom.downloads     as number) ?? 0,
      totalViews:       (rom.total_views   as number) ?? 0,
      uniqueCommenters: uniqueCommenters ?? 0,
      milestone100:     !!(rom.milestone_100_awarded),
      milestone500:     !!(rom.milestone_500_awarded),
      milestone1000:    !!(rom.milestone_1000_awarded),
    });

    if (total > 0) {
      await deductXP(rom.maintainer_uid as string, total, `delete_rom:${id}`);
    }

    // Clean up dedup rows in Supabase
    await sbAdmin.from("xp_comments_dedup").delete().eq("rom_id", id);

    // ── إرجاع الإنجازات التي لم يعد مستحقاً لها بعد الحذف ─────────────
    import("@/lib/server/achievements").then(({ revokeAchievements }) => {
      void revokeAchievements(rom.maintainer_uid as string);
    }).catch((err) => logger.error("roms.delete.revokeAchievements", err, { romId: id, uid: rom.maintainer_uid as string }));
  }).catch((err) => logger.error("roms.delete.computeAndDeductXP", err, { romId: id, uid: rom.maintainer_uid as string }));

  romCleanup({
    thumbnail:   rom.thumbnail   as string | undefined,
    screenshots: rom.screenshots as string[] | undefined,
  }).catch(console.error);
  romDeleted(rom.content_type as string).catch(console.error);


  return jsonResponse({ success: true }, 200, req);
}
