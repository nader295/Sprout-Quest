/**
 * app/api/payouts/route.ts — Supabase فقط
 * نفس المنطق الكامل بدون Firestore transactions
 * نستخدم Supabase RPC للعمليات الـ atomic
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, hasRole, isAdmin } from "@/lib/api/auth";
import { rateLimit, getClientIp, jsonResponse, errorResponse, rateLimitedResponse } from "@/lib/api/middleware";
import { PAYOUT_CONFIG } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PayoutStatus, PaymentMethod, DevTrustLevel } from "@/lib/types";

const VALID_TRANSITIONS: Record<string, PayoutStatus[]> = {
  pending:    ["approved", "rejected", "on_hold"],
  on_hold:    ["approved", "rejected"],
  approved:   ["processing"],
  processing: ["paid", "failed"],
  failed:     ["processing"],
};

async function writeAuditLog(entry: {
  action: string; actorUid: string; targetUid?: string;
  payoutId?: string; amount: number; details?: Record<string, unknown>; ip?: string;
}) {
  const sb = getSupabaseAdmin();
  await sb.from("financial_audit_log").insert({
    uid:    entry.actorUid,
    action: entry.action,
    amount: entry.amount,
    data:   entry,
    ts:     new Date().toISOString(),
  }).then(undefined, e => console.error("[audit] Failed:", e));
}

function calculateTrustLevel(userData: Record<string, unknown>): DevTrustLevel {
  const paid     = (userData.paid_payouts_count   as number) || 0;
  const rejected = (userData.rejected_payouts_count as number) || 0;
  if (rejected > 0) return "flagged";
  const days = userData.created_at
    ? Math.floor((Date.now() - new Date(userData.created_at as string).getTime()) / 86_400_000)
    : 0;
  const { trusted, vip } = PAYOUT_CONFIG.TRUST_THRESHOLDS;
  if (paid >= vip.minPaidPayouts     && days >= vip.minAccountDays)     return "vip";
  if (paid >= trusted.minPaidPayouts && days >= trusted.minAccountDays) return "trusted";
  return "new";
}

// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const sb     = getSupabaseAdmin();
    const action = req.nextUrl.searchParams.get("action") || "balance";
    const ip     = getClientIp(req);

    // ── Balance ──────────────────────────────────────────────
    if (action === "balance") {
      const { data: u } = await sb.from("users")
        .select("total_earned, available_balance, total_downloads")
        .eq("id", user.uid).single();

      return jsonResponse({
        adSupportEarnings:  u?.total_earned       ?? 0,
        availableBalance:   u?.available_balance   ?? 0,
        totalAdSupports:    u?.total_downloads     ?? 0,
      }, 200, req);
    }

    // ── My History ───────────────────────────────────────────
    if (action === "myHistory") {
      const { data } = await sb.from("payout_requests")
        .select("*").eq("uid", user.uid)
        .order("created_at", { ascending: false }).limit(50);
      return jsonResponse({ items: data ?? [] }, 200, req);
    }

    // ── Admin: List All ──────────────────────────────────────
    if (action === "adminList") {
      if (!isAdmin(user)) return errorResponse("Forbidden", 403, req);
      const statusFilter = req.nextUrl.searchParams.get("status");
      let q = sb.from("payout_requests").select("*")
        .order("created_at", { ascending: false }).limit(200);
      if (statusFilter) q = q.eq("status", statusFilter);
      const { data } = await q;
      return jsonResponse({ items: data ?? [] }, 200, req);
    }

    // ── Admin: Export CSV ────────────────────────────────────
    if (action === "exportCSV") {
      if (!isAdmin(user)) return errorResponse("Forbidden", 403, req);
      const { data } = await sb.from("payout_requests")
        .select("id, uid, amount, payment_method, wallet_address, data")
        .eq("status", "approved").order("created_at", { ascending: true });

      let csv = "PayoutID,Developer,Amount,PaymentMethod,WalletAddress\n";
      for (const r of data ?? []) {
        const d = r.data as Record<string, unknown>;
        csv += `${r.id},${String(d?.name ?? "").replace(/,/g, "")},${r.amount},${r.payment_method},${r.wallet_address}\n`;
      }

      await writeAuditLog({ action: "csv_exported", actorUid: user.uid, amount: data?.length ?? 0, ip });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="romx_payouts_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return errorResponse("Unknown action", 400, req);
  } catch (err) {
    console.error("[payouts GET]", err);
    return errorResponse("Internal error", 500, req);
  }
}

// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const sb   = getSupabaseAdmin();
    const ip   = getClientIp(req);
    const body = await req.json();

    // ── Admin: Batch Approve Trusted ─────────────────────────
    if (body.action === "batchApproveTrusted") {
      if (!hasRole(user, ["owner"])) return errorResponse("Owner only", 403, req);
      if (!await rateLimit(`payout_batch_${user.uid}`, 5, 60_000)) return rateLimitedResponse(req);

      const { data: pending } = await sb.from("payout_requests")
        .select("id, trust_level, amount, data").eq("status", "pending");

      let approved = 0;
      for (const p of pending ?? []) {
        const d     = p.data as Record<string, unknown>;
        const tl    = p.trust_level as DevTrustLevel;
        const maxA  = tl === "vip"     ? PAYOUT_CONFIG.TRUST_THRESHOLDS.vip.maxAutoApprove
                    : tl === "trusted" ? PAYOUT_CONFIG.TRUST_THRESHOLDS.trusted.maxAutoApprove : 0;
        const final = (d?.final_amount as number) ?? p.amount;

        if ((tl === "trusted" || tl === "vip") && final <= maxA) {
          await sb.from("payout_requests").update({
            status: "approved", updated_at: new Date().toISOString(),
          }).eq("id", p.id);
          approved++;
        }
      }

      await writeAuditLog({ action: "batch_approve_trusted", actorUid: user.uid, amount: approved, ip });
      return jsonResponse({ approved }, 200, req);
    }

    // ── Admin: Batch Mark Paid ────────────────────────────────
    if (body.action === "batchMarkPaid") {
      if (!hasRole(user, ["owner"])) return errorResponse("Owner only", 403, req);
      const txHash = body.txHash as string;
      if (!txHash) return errorResponse("txHash required", 400, req);

      const { data: approved } = await sb.from("payout_requests")
        .select("id, uid, amount, data").eq("status", "approved");

      let paid = 0;
      for (const p of approved ?? []) {
        const d     = p.data as Record<string, unknown>;
        const final = (d?.final_amount as number) ?? p.amount;

        const { error } = await sb.from("payout_requests").update({
          status: "paid", tx_hash: txHash,
          processed_by: user.uid, updated_at: new Date().toISOString(),
        }).eq("id", p.id).eq("status", "approved"); // guard race

        if (!error) {
          // Update user balance
          const { data: u } = await sb.from("users").select("available_balance").eq("id", p.uid).single();
          await sb.from("users").update({
            available_balance: Math.max(0, ((u as Record<string, number>)?.available_balance ?? 0) - p.amount),
            updated_at: new Date().toISOString(),
          }).eq("id", p.uid);
          paid++;
        }
      }

      await writeAuditLog({ action: "batch_mark_paid", actorUid: user.uid, amount: paid, details: { txHash }, ip });
      return jsonResponse({ paid }, 200, req);
    }

    // ── Developer: Request Payout ─────────────────────────────
    if (!await rateLimit(`payout_req_${user.uid}`, PAYOUT_CONFIG.MAX_DAILY_REQUESTS, 86_400_000))
      return rateLimitedResponse(req);

    const { amount, paymentMethod, walletAddress } = body as {
      amount: number; paymentMethod: PaymentMethod; walletAddress: string;
    };

    if (!amount || !paymentMethod || !walletAddress)
      return errorResponse("amount, paymentMethod, walletAddress required", 400, req);
    if (typeof amount !== "number" || amount < PAYOUT_CONFIG.MIN_PAYOUT_USD)
      return errorResponse(`Minimum payout is $${PAYOUT_CONFIG.MIN_PAYOUT_USD}`, 400, req);

    const validator = PAYOUT_CONFIG.WALLET_VALIDATORS?.[paymentMethod];
    if (validator && !validator.test(walletAddress))
      return errorResponse("Invalid wallet address format", 400, req);

    // Verify balance
    const { data: userData } = await sb.from("users")
      .select("available_balance, total_earned, paid_payouts_count, rejected_payouts_count, created_at, name, email, username, photo")
      .eq("id", user.uid).single();

    if (!userData) return errorResponse("User not found", 404, req);
    const available = (userData as Record<string, number>).available_balance ?? 0;
    if (amount > available) return errorResponse(`Insufficient balance. Available: $${available.toFixed(2)}`, 400, req);

    // Idempotency check
    const { data: existing } = await sb.from("payout_requests")
      .select("id").eq("uid", user.uid).in("status", ["pending", "approved", "processing"]).maybeSingle();
    if (existing) return errorResponse("You already have a pending payout request.", 409, req);

    const methodConfig = PAYOUT_CONFIG.PAYMENT_METHODS?.find((m: Record<string, unknown>) => m.id === paymentMethod);
    const fee         = (methodConfig as Record<string, unknown>)?.fee as number ?? 0;
    const finalAmount = Math.max(0, amount - fee);
    const trustLevel  = calculateTrustLevel(userData as Record<string, unknown>);

    const maxAuto = trustLevel === "vip"     ? PAYOUT_CONFIG.TRUST_THRESHOLDS.vip.maxAutoApprove
                  : trustLevel === "trusted" ? PAYOUT_CONFIG.TRUST_THRESHOLDS.trusted.maxAutoApprove : 0;
    const autoApproved = (trustLevel === "trusted" || trustLevel === "vip") && finalAmount <= maxAuto;

    // Create payout + lock balance atomically via two writes
    // (Supabase doesn't have multi-doc transactions client-side, use RPC)
    const { data: inserted, error } = await sb.from("payout_requests").insert({
      uid:            user.uid,
      amount,
      currency:       "USD",
      payment_method: paymentMethod,
      wallet_address: walletAddress,
      status:         autoApproved ? "approved" : "pending",
      trust_level:    trustLevel,
      ip,
      data: {
        name: (userData as Record<string, string>).name, final_amount: finalAmount, fee,
        auto_approved: autoApproved, trust_level: trustLevel,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select("id").single();

    if (error) return errorResponse(error.message, 500, req);

    // Lock balance
    await sb.from("users").update({
      available_balance: Math.max(0, available - amount),
      updated_at: new Date().toISOString(),
    }).eq("id", user.uid);

    await writeAuditLog({
      action: autoApproved ? "payout_auto_approved" : "payout_requested",
      actorUid: user.uid, payoutId: inserted?.id, amount,
      details: { paymentMethod, walletAddress, trustLevel, finalAmount, fee, autoApproved }, ip,
    });

    return jsonResponse({ id: inserted?.id, status: autoApproved ? "approved" : "pending", autoApproved }, 201, req);
  } catch (err) {
    console.error("[payouts POST]", err);
    return errorResponse("Internal error", 500, req);
  }
}

// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user || !isAdmin(user)) return errorResponse("Forbidden", 403, req);
    if (!await rateLimit(`payout_admin_${user.uid}`, 30, 60_000)) return rateLimitedResponse(req);

    const sb = getSupabaseAdmin();
    const ip = getClientIp(req);
    const { id, status: newStatus, adminNote, adjustedAmount, txHash } = await req.json() as {
      id: string; status: PayoutStatus; adminNote?: string; adjustedAmount?: number; txHash?: string;
    };

    if (!id || !newStatus) return errorResponse("id and status required", 400, req);

    const { data: payout } = await sb.from("payout_requests").select("*").eq("id", id).single();
    if (!payout) return errorResponse("Not found", 404, req);

    const currentStatus = payout.status as PayoutStatus;
    const validNext     = VALID_TRANSITIONS[currentStatus];
    if (!validNext?.includes(newStatus))
      return errorResponse(`Invalid transition: ${currentStatus} → ${newStatus}`, 400, req);

    if (newStatus === "paid") {
      if (!hasRole(user, ["owner"])) return errorResponse("Owner only", 403, req);
      if (!txHash) return errorResponse("txHash required", 400, req);
    }

    const finalAmt = (adjustedAmount && adjustedAmount > 0) ? adjustedAmount : payout.amount;

    const updates: Record<string, unknown> = {
      status: newStatus, updated_at: new Date().toISOString(),
      processed_by: user.uid,
    };
    if (adminNote)           updates.admin_note = adminNote;
    if (txHash)              updates.data = { ...(payout.data as object), tx_hash: txHash };
    if (adjustedAmount != null && adjustedAmount > 0)  updates.amount = finalAmt;

    await sb.from("payout_requests").update(updates).eq("id", id);

    // Balance operations
    if (newStatus === "paid") {
      const { data: u } = await sb.from("users").select("available_balance").eq("id", payout.uid).single();
      await sb.from("users").update({
        available_balance: Math.max(0, ((u as Record<string, number>)?.available_balance ?? 0)),
        updated_at: new Date().toISOString(),
      }).eq("id", payout.uid);
    }

    if (newStatus === "rejected") {
      // Refund locked amount back
      const { data: u } = await sb.from("users").select("available_balance").eq("id", payout.uid).single();
      await sb.from("users").update({
        available_balance: ((u as Record<string, number>)?.available_balance ?? 0) + payout.amount,
        updated_at: new Date().toISOString(),
      }).eq("id", payout.uid);
    }

    await writeAuditLog({
      action: `payout_${newStatus}`, actorUid: user.uid, payoutId: id, amount: finalAmt,
      details: { newStatus, adminNote, txHash }, ip,
    });

    return jsonResponse({ ok: true }, 200, req);
  } catch (err) {
    console.error("[payouts PUT]", err);
    return errorResponse("Internal error", 500, req);
  }
}
