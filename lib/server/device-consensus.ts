/**
 * lib/server/device-consensus.ts  — SERVER ONLY
 *
 * نظام التصويت والتوافق للـ codenames
 *
 * كيف يشتغل:
 *  • كل مطور يرفع ROM → يُسجَّل صوت في device_codename_votes
 *  • الـ cron اليومي يشغّل consolidateAllDevices()
 *  • الدالة تحسب الكودنيم الفائز (الأعلى ثقة × أصوات)
 *  • تحدّث device_codename في كل الـ ROMs اللي اسم جهازها متشابه
 *
 * المثال:
 *  10 مطورين رفعوا لـ "Poco X7 Pro" بكودنيم "rodin"   → 10 أصوات ثقة 1.0
 *   2 مطورين رفعوا لـ "Poco X7 Pro" بكودنيم "shiva"   →  2 أصوات ثقة 0.5
 *  الفائز: "rodin" → تُصحَّح الـ 2 رومات الغلطانة تلقائياً
 */

import { sbAdmin } from "@/lib/supabase/admin";
import { smartMatch } from "./device-normalize";

// ─────────────────────────────────────────────────────────────────────────────

export interface VoteRecord {
  deviceName: string;
  brand: string;
  codename: string;
  romId: string;
  maintainerUid: string;
  confidence: number;  // من smartMatch (0..1)
  source: "manual" | "smart" | "backfill";
}

export interface ConsolidationResult {
  deviceName: string;
  brand: string;
  winner: string;
  fixed: number;
  skipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * recordVote — يُسجَّل صوت عند رفع ROM جديد
 *
 * @param romId         - id الـ ROM بعد الحفظ
 * @param deviceName    - اسم الجهاز كما كتبه المطور
 * @param brand         - الـ brand
 * @param inputCodename - الكودنيم كما كتبه المطور (ممكن يكون غلط)
 * @param maintainerUid - uid المطور
 */
export async function recordVote(
  romId:          string,
  deviceName:     string,
  brand:          string,
  inputCodename:  string,
  maintainerUid:  string,
): Promise<void> {
  if (!deviceName?.trim()) return;

  // استخدم smartMatch لتحديد الكودنيم الحقيقي والثقة
  const match = await smartMatch(inputCodename, deviceName, brand);

  const finalCodename = match.matched
    ? match.codename
    : (inputCodename?.trim() || deviceName.toLowerCase().replace(/\s+/g, "_"));

  const confidence = match.matched ? match.confidence : 0.3;
  const source: VoteRecord["source"] = inputCodename?.trim() ? "manual" : "smart";

  try {
    await sbAdmin.from("device_codename_votes").upsert({
      rom_id:         romId,
      device_name:    deviceName.trim(),
      brand:          brand?.trim() || "",
      codename:       finalCodename,
      maintainer_uid: maintainerUid,
      confidence,
      source,
    }, { onConflict: "rom_id" });
  } catch (err) {
    console.error("[recordVote] Failed:", err);
  }
}

/**
 * consolidateAllDevices — يشتغل في الـ cron اليومي
 * يصلح كل الـ ROMs اللي عندها كودنيم غلط
 */
export async function consolidateAllDevices(): Promise<ConsolidationResult[]> {
  const { data, error } = await sbAdmin.rpc("consolidate_all_devices");
  if (error) {
    console.error("[consolidateAllDevices] RPC error:", error);
    return [];
  }
  return (data || []).map((r: Record<string, unknown>) => ({
    deviceName: r.device_name as string,
    brand:      r.brand       as string,
    winner:     r.winner      as string,
    fixed:      Number(r.fixed),
    skipped:    Number(r.skipped),
  }));
}

/**
 * getConsensusCodename — اعرف الكودنيم الفائز لجهاز معين
 * مفيد لو عايز تتحقق قبل الحفظ
 */
export async function getConsensusCodename(
  deviceName: string,
  brand = "",
): Promise<string | null> {
  const { data } = await sbAdmin.rpc("get_consensus_codename", {
    p_device_name: deviceName,
    p_brand:       brand,
  });
  return data as string | null;
}

/**
 * resolveWithConsensus — يدمج smartMatch + DB consensus
 * الأولوية: DB consensus > smartMatch
 *
 * يُستخدم في الـ suggest API لإرجاع اقتراح أكثر دقة
 */
export async function resolveWithConsensus(
  inputCodename: string,
  deviceName:    string,
  brand =        "",
): Promise<{
  codename:     string;
  confidence:   number;
  source:       "consensus" | "smart" | "fallback";
  voteCount:    number;
}> {
  // Phase 1: هل فيه consensus في DB؟
  if (deviceName?.trim()) {
    const { data } = await sbAdmin
      .rpc("resolve_device_codename", {
        p_device_name:    deviceName,
        p_brand:          brand,
        p_input_codename: inputCodename,
      })
      .single();

    if (data) {
      const row = data as Record<string, unknown>;
      const winnerVotes = Number(row.winner_votes) || 0;
      const totalVotes  = Number(row.total_votes)  || 0;
      const conf        = Number(row.winner_confidence) || 0;

      // نثق بالـ consensus لو فيه >= 2 أصوات أو ثقة > 0.7
      if (winnerVotes >= 2 || conf > 0.7) {
        return {
          codename:   row.winner_codename as string,
          confidence: Math.min(1, conf / totalVotes),
          source:     "consensus",
          voteCount:  winnerVotes,
        };
      }
    }
  }

  // Phase 2: smartMatch
  const match = await smartMatch(inputCodename, deviceName, brand);
  if (match.matched) {
    return {
      codename:   match.codename,
      confidence: match.confidence,
      source:     "smart",
      voteCount:  0,
    };
  }

  // Phase 3: fallback
  return {
    codename:   inputCodename?.trim() || "",
    confidence: 0.3,
    source:     "fallback",
    voteCount:  0,
  };
}
