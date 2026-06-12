import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

// GET /api/community — returns aggregated country stats for the map
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30, 60_000)) return rateLimitedResponse(req);

  try {
    const sb = getSupabaseAdmin();

    // Total active users (for NODES counter)
    const { count: totalUsers } = await sb
      .from("users")
      .select("*", { count: "exact", head: true })
      .neq("role", "banned")
      .or('is_suspended.is.null,is_suspended.eq.false');

    // ALL users with a country — used for REGIONS + DEV NODES aggregate stats
    // Note: show_on_map only controls individual pin visibility (privacy feature)
    const { data: allUsersWithCountry } = await sb
      .from("users")
      .select("country, country_name, roms_count")
      .neq("role", "banned")
      .or('is_suspended.is.null,is_suspended.eq.false')
      .not("country", "is", null)
      .neq("country", "")
      .limit(5000);

    // Users who opted-in to show their profile on the globe (for pin/sample display only)
    const { data: optedInUsers } = await sb
      .from("users")
      .select("country, name, photo, username")
      .eq("show_on_map", true)
      .or('is_suspended.is.null,is_suspended.eq.false')
      .limit(2000);

    // Aggregate by country from ALL users with a country
    const countries: Record<string, {
      code: string; name: string; count: number;
      publishers: number;
      samples: { name: string; photo: string; username: string }[];
    }> = {};

    (allUsersWithCountry ?? []).forEach(d => {
      if (!d.country) return;
      const code = String(d.country).toUpperCase();
      if (!countries[code]) {
        countries[code] = { code, name: (d.country_name as string) || code, count: 0, publishers: 0, samples: [] };
      }
      countries[code].count++;
      if ((d.roms_count as number || 0) > 0) countries[code].publishers++;
    });

    // Add profile samples only from opted-in users (privacy-respecting)
    (optedInUsers ?? []).forEach(d => {
      if (!d.country) return;
      const code = String(d.country).toUpperCase();
      if (countries[code] && countries[code].samples.length < 3) {
        countries[code].samples.push({
          name: (d.name as string) || "",
          photo: (d.photo as string) || "",
          username: (d.username as string) || "",
        });
      }
    });

    const result = Object.values(countries).sort((a, b) => b.count - a.count);
    return jsonResponse({ countries: result, total: totalUsers || 0 });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500);
  }
}
