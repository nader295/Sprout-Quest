/**
 * ensure-user.ts — Canonical server-side ensureUser entry point
 *
 * Single source of truth for user creation / upsert.
 * The implementation lives in sync.ts (which handles dual-DB consistency),
 * but all consumers should import from this file.
 */
export { ensureUser } from "./sync";
