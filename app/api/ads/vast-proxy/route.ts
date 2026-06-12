import { NextRequest, NextResponse } from "next/server";

/**
 * Server-Side Proxy for VAST XML Tags
 * Purpose: Bypasses strict CORS policies applied by Ad Networks (Exoclick, etc)
 * How it works: 
 *  1. Frontend video player fetches this route.
 *  2. This route fetches Exoclick VAST securely Server-to-Server.
 *  3. This route returns XML payload to frontend.
 *  4. Ad blocker mechanisms are completely blind to this.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (targetUrl === "MOCK") {
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="1">
    <InLine>
      <AdSystem>RomX Test</AdSystem>
      <AdTitle>Support Test Ad</AdTitle>
      <Impression>#impression</Impression>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>00:00:30</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="1280" height="720"><![CDATA[https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4]]></MediaFile>
            </MediaFiles>
            <TrackingEvents>
              <Tracking event="start">#start</Tracking>
              <Tracking event="complete">#complete</Tracking>
            </TrackingEvents>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return new NextResponse("Missing or invalid 'url' parameter", { status: 400 });
  }

  try {
    const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const referer = req.headers.get("referer") || "https://rom-x.vercel.app/";

    const response = await fetch(targetUrl, {
      // It's CRITICAL to forward the client's REAL IP and User-Agent; 
      // otherwise Ad Networks (Exoclick) will think it's a Bot/Datacenter proxy
      // and will return 0 ads (empty VAST XML) to protect advertisers.
      headers: {
        "User-Agent": userAgent,
        "X-Forwarded-For": clientIp,
        "X-Real-IP": clientIp,
        "Referer": referer,
        "Origin": "https://rom-x.vercel.app"
      },
      next: { revalidate: 0 } // never cache VAST tags since they are dynamic per view
    });

    if (!response.ok) {
      return new NextResponse("Ad Network returned bad status: " + response.status, { status: 502 });
    }

    const xmlText = await response.text();

    return new NextResponse(xmlText, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[VAST Proxy] Error fetching VAST tag:", error);
    return new NextResponse("Internal Server Error while fetching VAST", { status: 500 });
  }
}
