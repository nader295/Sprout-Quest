/**
 * app/api/admin/backfill-devices/route.ts
 *
 * POST /api/admin/backfill-devices
 *
 * يستدعيه الـ admin يدوياً لجلب أجهزة جديدة من:
 * - LineageOS GitHub
 * - TWRP GitHub
 * - Certified Android dataset
 *
 * مؤمّن بـ admin token
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { errorResponse } from "@/lib/api/middleware";
import { runDeviceIngestion } from "@/lib/server/device-ingestion";
import { invalidateDevicesCache } from "@/lib/server/devices-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return errorResponse("Unauthorized", 401, req);

  const body = await req.json().catch(() => ({}));
  const sources = body.sources || ["lineageos", "twrp", "certified"];
  const skipExisting = body.skipExisting !== false;
  const limit = Math.min(body.limit || 500, 1000);

  const result = await runDeviceIngestion({ sources, limit, skipExisting });

  // Invalidate cache عشان الأجهزة الجديدة تظهر فوراً
  invalidateDevicesCache();

  return NextResponse.json({
    ok: true,
    ...result,
    message: `تم إضافة ${result.added} جهاز جديد (من ${result.total} تم جلبهم)`,
  });
}

export async function GET(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return errorResponse("Unauthorized", 401, req);

  // Preview — بدون حفظ
  const { runDeviceIngestion: rdi } = await import("@/lib/server/device-ingestion");
  const result = await rdi({ sources: ["lineageos"], limit: 50, skipExisting: false });

  return NextResponse.json({
    preview: true,
    total: result.total,
    sample: result,
  });
}
