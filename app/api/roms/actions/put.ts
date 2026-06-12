import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { resolveDevice, recordDeviceVote, cleanCodename } from "@/lib/server/smart-device-engine";
import { writeActivity } from "@/lib/server/feed";
import { XP_REWARDS } from "@/lib/constants";
import { awardXP } from "../utils";
import { logger } from "@/lib/logger";

export async function handlePut(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`put:${ip}`, 30, 60_000)) return rateLimitedResponse(req);
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid body", 400, req);
  const { id, ...updates } = body;
  if (!id) return errorResponse("Missing id", 400, req);

  const { data: romRow } = await sbAdmin.from("roms").select("maintainer_uid,name,version").eq("id", id).single();
  if (!romRow) return errorResponse("Not found", 404, req);
  const rom = romRow as Record<string, unknown>;

  if (rom.maintainer_uid !== user.uid && !isAdmin(user)) return errorResponse("Forbidden", 403, req);

  const fieldMap: Record<string, string> = {
    name:"name", brand:"brand", device:"device", android:"android", version:"version",
    size:"size", downloadUrl:"download_url", mirrorUrl:"mirror_url", description:"description",
    changelog:"changelog", thumbnail:"thumbnail", screenshots:"screenshots", tags:"tags",
    romStatus:"rom_status", romType:"rom_type", installGuide:"install_guide",
    checksumMd5:"checksum_md5", checksumSha256:"checksum_sha256", kernelVersion:"kernel_version",
    recoveryType:"recovery_type", moduleId:"module_id", minMagisk:"min_magisk",
    moduleManager:"module_manager", variants:"variants",
    compatibleDevices:"compatible_devices", mirrors:"mirrors", contentType:"content_type",
    deviceCodename:"device_codename",
    kernelType:"kernel_type", anyKernelTargets:"anykernel_targets",
    moduleScope:"module_scope", moduleManagers:"module_managers",
    trebleType:"treble_type", gsiArch:"gsi_arch", gsiType:"gsi_type",
    socFamily:"soc_family", xdaUrl:"xda_url", telegramUrl:"telegram_url",
    sourceUrl:"source_url", knownIssues:"known_issues",
    minRam:"min_ram", minStorage:"min_storage",
    linkvertiseEnabled:"linkvertise_enabled",
  };

  const sbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in updates) sbUpdates[snake] = updates[camel];
  }

  const codenameChanged = "deviceCodename" in updates && (updates.deviceCodename as string || "").trim() !== "";
  const deviceChanged   = "device"         in updates && (updates.device         as string || "").trim() !== "";

  if (codenameChanged || deviceChanged) {
    const raw        = (updates.deviceCodename as string || "").trim();
    const deviceName = (updates.device         as string || "").trim();
    const brand      = (updates.brand          as string || "").trim();
    if (raw) {
      sbUpdates["device_codename"] = cleanCodename(raw);
    } else if (deviceName) {
      const result = await resolveDevice("", deviceName, brand);
      sbUpdates["device_codename"] = result.best ? result.best.codename : cleanCodename(deviceName);
    }
  }

  await sbAdmin.from("roms").update(sbUpdates).eq("id", id);

  if ((codenameChanged || deviceChanged) && sbUpdates["device_codename"]) {
    recordDeviceVote(
      id,
      (updates.device as string || "").trim(),
      (updates.brand  as string || "").trim(),
      (updates.deviceCodename as string || sbUpdates["device_codename"] as string || ""),
      user.uid,
    ).catch((err) => logger.error("roms.put.recordDeviceVote", err, { romId: id, uid: user.uid }));
  }

  const updatedDeviceImage = (updates.deviceImage as string || "").trim();
  const updatedCodename    = (sbUpdates["device_codename"] as string || "").trim();
  if (updatedDeviceImage && updatedCodename) {
    void sbAdmin.from("devices").upsert({
      codename:          updatedCodename,
      image_url:         updatedDeviceImage,
      image_source:      "manual",
      image_verified_at: new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    }, { onConflict: "codename", ignoreDuplicates: false }).then(() => {}, () => {});
  }

  if (updates.version && updates.version !== rom.version) {
    awardXP(user.uid, XP_REWARDS.VERSION_UPDATE, "VERSION_UPDATE");
    void sbAdmin.from("users").select("name,photo").eq("id", user.uid).single().then(({ data: devRow }) => {
      const dev = devRow as Record<string, unknown> | null;
      writeActivity({ uid: user.uid, username: dev?.name as string || "",
        photo: dev?.photo as string || "", type: "new_version", romId: id,
        romName: rom.name as string || updates.name || "" })
        .catch((err) => logger.error("roms.put.writeActivity", err, { romId: id, uid: user.uid }));
    }).then(undefined, () => {});
  }

  return jsonResponse({ success: true }, 200, req);
}
