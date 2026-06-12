// Re-export auth utilities from the Firebase layer
export { verifyRequest, hasRole, isAdmin } from "@/lib/firebase/auth-verify";
export type { VerifiedUser } from "@/lib/firebase/auth-verify";
