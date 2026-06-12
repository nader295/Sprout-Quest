import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// ── Helpers ────────────────────────────────────────────────────────────────

// Optimize Cloudinary URL for the phone-mockup screenshot (portrait crop)
function getOgImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;
  return url.replace(
    /\/image\/upload\//,
    "/image/upload/f_jpg,q_90,w_640,h_960,c_fill,g_auto/"
  );
}

// Optimize Cloudinary URL for the round avatar
function getAvatarUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;
  return url.replace(
    /\/image\/upload\//,
    "/image/upload/f_jpg,q_85,w_120,h_120,c_fill,g_face/"
  );
}

function formatNumber(n: number | undefined): string {
  if (!n || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ romId: string }> }
) {
  try {
    const { romId } = await params;

    // Fetch ROM data fresh so previews always reflect the latest content.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const res = await fetch(`${baseUrl}/api/roms?id=${romId}`, {
      cache: "no-store",
    });

    // ── Branding palette per content type ────────────────────────────────
    const fallbackPalette = { from: "#0ea5e9", to: "#6366f1", glow: "#3b82f6" };

    // If ROM fetch fails → render a clean branded fallback (still shows an image)
    let rom: Record<string, unknown> = {};
    if (res.ok) {
      try {
        rom = await res.json();
      } catch {
        rom = {};
      }
    }

    const title = (rom.name as string) || "Custom ROM";
    const device = (rom.device as string) || "";
    const brand = (rom.brand as string) || "";
    const android = (rom.android as string) || "";
    const version = (rom.version as string) || "";
    const maintainer = (rom.maintainerName as string) || "Developer";
    const maintainerPhoto = getAvatarUrl(rom.maintainerPhoto as string | undefined);

    const screenshots = Array.isArray(rom.screenshots) ? (rom.screenshots as string[]) : [];
    const rawImage = (rom.thumbnail as string) || screenshots[0] || "";
    const imageUrl = getOgImageUrl(rawImage);
    const hasImage = Boolean(imageUrl);

    const contentType = (rom.contentType as string) || "rom";
    const typeLabel =
      contentType === "kernel" ? "KERNEL"
      : contentType === "recovery" ? "RECOVERY"
      : contentType === "module" ? "MODULE"
      : contentType === "gsi" ? "GSI"
      : "ROM";

    const palette =
      contentType === "kernel"   ? { from: "#a855f7", to: "#6366f1", glow: "#8b5cf6" }
      : contentType === "recovery" ? { from: "#f59e0b", to: "#ef4444", glow: "#f97316" }
      : contentType === "module"   ? { from: "#10b981", to: "#06b6d4", glow: "#14b8a6" }
      : contentType === "gsi"      ? { from: "#ec4899", to: "#f43f5e", glow: "#e11d48" }
      :                              fallbackPalette;

    const downloads = formatNumber(rom.downloads as number | undefined);
    const views = formatNumber((rom.total_views as number | undefined) ?? (rom.totalViews as number | undefined));
    const likes = formatNumber(rom.likesCount as number | undefined);
    const ratingNum = rom.ratingAvg as number | undefined;
    const rating = ratingNum ? String(Math.round(ratingNum * 10) / 10) : null;

    const safeTitle = title.length > 24 ? title.slice(0, 22) + "…" : title;
    const safeMaintainer = maintainer.length > 18 ? maintainer.slice(0, 16) + "…" : maintainer;
    const deviceLine = brand && device ? `${brand} ${device}` : (device || brand || "Android Device");

    const image = new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            backgroundColor: "#05070d",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Aurora gradient mesh background */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              backgroundImage: `radial-gradient(ellipse 70% 60% at 15% 20%, ${palette.from}55 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 85% 80%, ${palette.to}50 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, ${palette.glow}25 0%, transparent 70%)`,
            }}
          />

          {/* Subtle dot grid */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              opacity: 0.5,
            }}
          />

          {/* Top accent line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "6px",
              display: "flex",
              backgroundImage: `linear-gradient(90deg, ${palette.from} 0%, ${palette.to} 100%)`,
            }}
          />

          {/* Bottom accent line */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "6px",
              display: "flex",
              backgroundImage: `linear-gradient(90deg, ${palette.to} 0%, ${palette.from} 100%)`,
            }}
          />

          {/* Main two-column layout */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              padding: "56px 64px",
              position: "relative",
            }}
          >
            {/* ── LEFT: Phone mockup with screenshot ─────────────────── */}
            <div
              style={{
                display: "flex",
                width: "320px",
                height: "100%",
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                marginRight: "56px",
              }}
            >
              {/* Glow halo behind phone */}
              <div
                style={{
                  position: "absolute",
                  width: "320px",
                  height: "480px",
                  display: "flex",
                  backgroundImage: `radial-gradient(ellipse, ${palette.glow}55 0%, transparent 70%)`,
                  filter: "blur(40px)",
                }}
              />

              {/* Phone frame */}
              <div
                style={{
                  display: "flex",
                  width: "280px",
                  height: "500px",
                  borderRadius: "44px",
                  backgroundImage: "linear-gradient(145deg, #1a1f2e 0%, #0a0d14 100%)",
                  padding: "10px",
                  position: "relative",
                  boxShadow: `0 0 0 2px ${palette.from}40, 0 30px 60px rgba(0,0,0,0.6)`,
                }}
              >
                {/* Screen */}
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    borderRadius: "36px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    position: "relative",
                  }}
                >
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      width="260"
                      height="480"
                      style={{
                        width: "260px",
                        height: "480px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    /* Branded fallback */
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        backgroundImage: `linear-gradient(160deg, ${palette.from} 0%, ${palette.to} 100%)`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          fontSize: "120px",
                          color: "rgba(255,255,255,0.95)",
                          marginBottom: "12px",
                        }}
                      >
                        ⚡
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: "26px",
                          fontWeight: 900,
                          color: "white",
                          letterSpacing: "8px",
                        }}
                      >
                        {typeLabel}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notch */}
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "90px",
                    display: "flex",
                    width: "100px",
                    height: "26px",
                    backgroundColor: "#000",
                    borderTopLeftRadius: "0",
                    borderTopRightRadius: "0",
                    borderBottomLeftRadius: "16px",
                    borderBottomRightRadius: "16px",
                  }}
                />
              </div>
            </div>

            {/* ── RIGHT: Content ─────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "space-between",
                paddingTop: "12px",
                paddingBottom: "12px",
              }}
            >
              {/* Top: badges + title + device line */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Badges row */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      backgroundImage: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
                      padding: "10px 22px",
                      borderRadius: "12px",
                      marginRight: "12px",
                      boxShadow: `0 8px 24px ${palette.glow}55`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        marginRight: "10px",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        color: "white",
                        fontSize: "22px",
                        fontWeight: 900,
                        letterSpacing: "2px",
                      }}
                    >
                      {typeLabel}
                    </div>
                  </div>

                  {version && (
                    <div
                      style={{
                        display: "flex",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        padding: "10px 22px",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ display: "flex", color: "rgba(255,255,255,0.95)", fontSize: "22px", fontWeight: 700 }}>
                        v{version}
                      </div>
                    </div>
                  )}
                </div>

                {/* Title */}
                <div
                  style={{
                    display: "flex",
                    fontSize: "84px",
                    fontWeight: 900,
                    color: "white",
                    lineHeight: 1,
                    letterSpacing: "-3px",
                    marginBottom: "20px",
                  }}
                >
                  {safeTitle}
                </div>

                {/* Device line */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "26px",
                      color: "rgba(255,255,255,0.85)",
                      fontWeight: 600,
                    }}
                  >
                    {deviceLine}
                  </div>

                  {android && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255,255,255,0.3)",
                          marginLeft: "14px",
                          marginRight: "14px",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          fontSize: "26px",
                          color: "#34d399",
                          fontWeight: 700,
                        }}
                      >
                        Android {android}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom: stats card + maintainer + brand */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Stats card (glassmorphism) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "20px",
                    padding: "20px 28px",
                    marginBottom: "24px",
                  }}
                >
                  {/* Downloads */}
                  <div style={{ display: "flex", alignItems: "center", marginRight: "28px" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "24px",
                        color: "#38bdf8",
                        marginRight: "10px",
                      }}
                    >
                      ↓
                    </div>
                    <div style={{ display: "flex", fontSize: "26px", color: "white", fontWeight: 700 }}>
                      {downloads}
                    </div>
                  </div>

                  <div style={{ display: "flex", width: "1px", height: "32px", backgroundColor: "rgba(255,255,255,0.1)", marginRight: "28px" }} />

                  {/* Views */}
                  <div style={{ display: "flex", alignItems: "center", marginRight: "28px" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "24px",
                        color: "#a78bfa",
                        marginRight: "10px",
                      }}
                    >
                      ◉
                    </div>
                    <div style={{ display: "flex", fontSize: "26px", color: "white", fontWeight: 700 }}>
                      {views}
                    </div>
                  </div>

                  <div style={{ display: "flex", width: "1px", height: "32px", backgroundColor: "rgba(255,255,255,0.1)", marginRight: "28px" }} />

                  {/* Likes */}
                  <div style={{ display: "flex", alignItems: "center", marginRight: rating ? "28px" : "0" }}>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "24px",
                        color: "#fb7185",
                        marginRight: "10px",
                      }}
                    >
                      ♥
                    </div>
                    <div style={{ display: "flex", fontSize: "26px", color: "white", fontWeight: 700 }}>
                      {likes}
                    </div>
                  </div>

                  {rating && (
                    <>
                      <div style={{ display: "flex", width: "1px", height: "32px", backgroundColor: "rgba(255,255,255,0.1)", marginRight: "28px" }} />
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            fontSize: "24px",
                            color: "#fbbf24",
                            marginRight: "10px",
                          }}
                        >
                          ★
                        </div>
                        <div style={{ display: "flex", fontSize: "26px", color: "white", fontWeight: 700 }}>
                          {rating}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Maintainer + RomX brand */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {maintainerPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={maintainerPhoto}
                        alt=""
                        width="48"
                        height="48"
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "24px",
                          marginRight: "14px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "48px",
                          height: "48px",
                          borderRadius: "24px",
                          backgroundImage: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
                          fontSize: "22px",
                          fontWeight: 800,
                          color: "white",
                          marginRight: "14px",
                        }}
                      >
                        {maintainer.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", fontSize: "16px", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                        Maintained by
                      </div>
                      <div style={{ display: "flex", fontSize: "24px", color: "white", fontWeight: 700 }}>
                        {safeMaintainer}
                      </div>
                    </div>
                  </div>

                  {/* RomX logo */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        backgroundImage: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
                        boxShadow: `0 8px 20px ${palette.glow}55`,
                        marginRight: "10px",
                        fontSize: "26px",
                        fontWeight: 900,
                        color: "white",
                      }}
                    >
                      X
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: "32px",
                        fontWeight: 900,
                        color: "white",
                        letterSpacing: "-1px",
                      }}
                    >
                      RomX
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    // Short edge cache so social platforms can refresh after updates
    image.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"
    );
    image.headers.set("Content-Type", "image/png");
    return image;
  } catch (e) {
    console.error("[v0] OG image error:", e);
    // Last-resort fallback: render a simple branded image instead of 500
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#05070d",
            backgroundImage:
              "radial-gradient(ellipse at top, #0ea5e955 0%, transparent 60%), radial-gradient(ellipse at bottom, #6366f155 0%, transparent 60%)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "120px",
              height: "120px",
              borderRadius: "32px",
              backgroundImage: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
              fontSize: "72px",
              fontWeight: 900,
              color: "white",
              marginBottom: "32px",
              boxShadow: "0 20px 40px #3b82f680",
            }}
          >
            X
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "96px",
              fontWeight: 900,
              color: "white",
              letterSpacing: "-2px",
            }}
          >
            RomX
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              color: "rgba(255,255,255,0.6)",
              fontWeight: 500,
              marginTop: "16px",
            }}
          >
            The Android Development Platform
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
