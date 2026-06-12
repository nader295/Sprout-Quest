import { NextRequest } from "next/server";
import { adminAuth } from "./admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_EMAIL } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  role: UserRole;
  banned: boolean;
  suspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason?: string;
  xp: number;
  createdAt: Date | null;
  reportBannedUntil: Date | null;
}

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the user info or null if invalid/missing.
 */
export async function verifyRequest(req: NextRequest): Promise<VerifiedUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    
    // Fetch user data from Supabase instead of Firestore
    const sb = getSupabaseAdmin();
    // Select only the columns actually needed for auth verification.
    // Avoids fetching large JSONB fields (achievements, donation_links, etc.)
    // on every single authenticated API request (30 routes × all users).
    const { data: userData } = await sb
      .from("users")
      .select("role, xp, is_suspended, suspended_until, suspension_reason, report_banned_until, created_at")
      .eq("id", decoded.uid)
      .maybeSingle();

    // إذا كان البريد يطابق ADMIN_EMAIL → owner — لكن فقط عندما يكون مُتحقَّقاً منه.
    // بدون فحص email_verified، مهاجم يستخدم بريد غير مُتحقّق منه ويصبح owner.
    // ADMIN_EMAIL في constants.ts مُطَبَّع بالفعل (trim + toLowerCase).
    let role: UserRole = (userData?.role as UserRole) || "user";
    if (
      ADMIN_EMAIL &&
      decoded.email &&
      decoded.email_verified === true &&
      decoded.email.toLowerCase() === ADMIN_EMAIL
    ) {
      role = "owner";
    }

    // Parse suspension
    const suspendedUntil = userData?.suspended_until ? new Date(userData.suspended_until) : null;
    const now = new Date();
    const isSuspended = suspendedUntil !== null && suspendedUntil > now;

    // Parse report ban
    const reportBannedUntil = userData?.report_banned_until ? new Date(userData.report_banned_until) : null;

    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      role,
      banned: userData?.role === "banned",
      suspended: isSuspended,
      suspendedUntil: isSuspended ? suspendedUntil : null,
      suspensionReason: userData?.suspension_reason,
      xp: userData?.xp || 0,
      createdAt: userData?.created_at ? new Date(userData.created_at) : null,
      reportBannedUntil:
        reportBannedUntil && reportBannedUntil > now ? reportBannedUntil : null,
    };
  } catch {
    return null;
  }
}

/** Check if the user has one of the allowed roles. */
export function hasRole(user: VerifiedUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

/** Check if the user is an admin (owner, admin, or moderator). */
export function isAdmin(user: VerifiedUser): boolean {
  return hasRole(user, ["owner", "admin", "moderator"]);
}
