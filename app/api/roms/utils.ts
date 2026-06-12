import { sendNotif } from "@/lib/server/notifications";
import { sbAdmin } from "@/lib/supabase/admin";
import { mapToCamelCase } from "@/lib/utils/snake-to-camel";
import { logger } from "@/lib/logger";

// ── XP functions — all from lib/server/xp.ts ───────────────────────
export async function awardXP(uid: string, amount: number, reason?: string) {
  const { awardXP: xpAward } = await import("@/lib/server/xp");
  await xpAward(uid, amount, reason);
  // Note: lib/server/xp.ts already handles the Supabase update via atomic_award_xp RPC.
  // Do NOT call increment_user_xp here — that would double the XP.
}

export async function deductXP(uid: string, amount: number, reason?: string) {
  const { deductXP: xpDeduct } = await import("@/lib/server/xp");
  await xpDeduct(uid, amount, reason);
}

// ── normalize Supabase row → frontend shape ──────────────────
export function nr(row: Record<string, unknown>): Record<string, unknown> {
  const c = mapToCamelCase(row);
  c.variants = c.variants || [];
  c.screenshots = c.screenshots || [];
  c.tags = c.tags || [];
  c.mirrors = c.mirrors || [];
  c.moduleManagers = c.moduleManagers || ["any"];
  c.moduleManager = c.moduleManager ?? "any";
  c.supportCount = c.supportCount ?? 0;
  c.healthScore = c.healthScore ?? 0;
  c.linkvertiseEnabled = c.linkvertiseEnabled ?? false;
  
  const strFields = [
    "deviceCodename", "kernelType", "anyKernelTargets", "moduleScope", 
    "trebleType", "gsiArch", "gsiType", "socFamily", "xdaUrl", 
    "telegramUrl", "sourceUrl", "knownIssues", "minRam", "minStorage"
  ];
  for (const f of strFields) {
    c[f] = c[f] ?? "";
  }
  return c;
}

// ── Notify users watching a specific device for new ROMs ──────────────
export async function notifyDeviceWatchers(
  romId: string,
  device: string,
  compatibleDevices: string[],
  romName: string,
  maintainerUid: string
): Promise<void> {
  const devicesToCheck = [...new Set([device, ...compatibleDevices].filter(Boolean))];
  if (!devicesToCheck.length) return;

  for (const dev of devicesToCheck) {
    try {
      const { data: watchers } = await sbAdmin
        .from("device_watches")
        .select("uid")
        .ilike("device", dev.toLowerCase().trim())
        .limit(200);

      if (!watchers?.length) continue;

      for (const watcher of watchers) {
        const watcherUid = (watcher as Record<string, unknown>).uid as string;
        if (!watcherUid || watcherUid === maintainerUid) continue;
        sendNotif({
          recipientUid: watcherUid,
          type: "broadcast",
          title: `📱 ROM جديد لجهازك: ${dev}`,
          body: `تم نشر "${romName}" لجهاز ${dev}. تحقق منه الآن!`,
          link: `/rom/${romId}`,
          dedupKey: `device_watch_${romId}_${dev}_${watcherUid}`,
        }).catch((err) => logger.error("roms.notifyDeviceWatchers", err, { romId, watcherUid, dev }));
      }
    } catch { /* تجاهل الأخطاء */ }
  }
}
