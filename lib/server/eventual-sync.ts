import { sbAdmin } from "@/lib/supabase/admin";

type SyncOperation = {
  table: string;
  operation: 'upsert' | 'update' | 'delete';
  data: Record<string, unknown>;
  filter?: { column: string; value: string };
};

/**
 * Fire-and-forget Supabase sync — never blocks the primary Firebase write.
 * Failed operations are logged for retry by the daily cron.
 */
export async function syncToSupabase(op: SyncOperation): Promise<void> {
  try {
    if (op.operation === 'upsert') {
      await sbAdmin.from(op.table).upsert(op.data);
    } else if (op.operation === 'update' && op.filter) {
      await sbAdmin.from(op.table)
        .update(op.data)
        .eq(op.filter.column, op.filter.value);
    } else if (op.operation === 'delete' && op.filter) {
      await sbAdmin.from(op.table)
        .delete()
        .eq(op.filter.column, op.filter.value);
    }
  } catch (err) {
    // Log failed sync for cron retry — never throw
    console.error(`[eventual-sync] Failed \${op.operation} on \${op.table}:`, err);
    // Note: Can optionally push to Redis queue here if needed in the future
  }
}
