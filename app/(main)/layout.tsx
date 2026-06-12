"use client";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { UsernameSetupModal } from "@/components/shared/username-setup-modal";
import { SuspensionOverlay } from "@/components/shared/suspension-overlay";
import { ToastContainer } from "@/components/shared/toast";
import { OnboardingTour } from "@/components/shared/OnboardingTour";

import { ErrorBoundary } from "@/components/shared/error-boundary";
import { CommandPalette } from "@/components/shared/command-palette";
import CursorAura from "@/components/shared/cursor-aura";
import ScrollProgress from "@/components/shared/scroll-progress";
import { motion, AnimatePresence } from "framer-motion";

// ── Global scroll-reveal observer ────────────────────────────────────────────
if (typeof window !== "undefined") {
  const scrollObserver = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        scrollObserver.unobserve(e.target);
      }
    }),
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  // Re-observe on route change
  const observeElements = () => {
    document.querySelectorAll(".scroll-fade:not(.visible)").forEach(el => scrollObserver.observe(el));
  };
  // Run initially
  setTimeout(observeElements, 300);
  // Only observe *newly added* .scroll-fade elements instead of re-querying entire DOM
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains("scroll-fade") && !node.classList.contains("visible")) {
          scrollObserver.observe(node);
        }
        node.querySelectorAll?.(".scroll-fade:not(.visible)")
          .forEach(el => scrollObserver.observe(el));
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
import { useSettings } from "@/lib/hooks/use-settings";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

// ── Scroll position restoration ───────────────────────────────────────────────
const scrollPositions = new Map<string, number>();

function useScrollRestoration() {
  const pathname = usePathname();
  const prevPath = useRef<string>("");

  useEffect(() => {
    // Save scroll position when leaving a page
    const saveScroll = () => {
      if (prevPath.current) {
        scrollPositions.set(prevPath.current, window.scrollY);
      }
    };

    // Restore scroll position when arriving at a page
    const restore = scrollPositions.get(pathname);
    if (restore !== undefined && restore > 0) {
      // Small delay to let page render first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: restore, behavior: "instant" });
        });
      });
    } else {
      // New page — go to top
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    prevPath.current = pathname;

  }, [pathname]);
}

/* ─── Shared hook: pauses canvas when off-screen or reduced-motion ─── */
function useCanvasVisibility() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);

    // IntersectionObserver — pause when out of viewport
    const container = containerRef.current;
    if (!container) return () => mq.removeEventListener("change", onChange);

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    observer.observe(container);

    return () => {
      mq.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, []);

  return { containerRef, canvasRef, isVisible, prefersReducedMotion };
}

/* ─── AURORA — Cinematic Northern Lights via canvas ─────────── */
function AuroraBackground() {
  const { containerRef, canvasRef, isVisible, prefersReducedMotion } = useCanvasVisibility();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    // Fewer, more focused bands — cool-toned palette for harmony
    const bands = [
      { yBase: 0.22, amp: 0.09, phaseSpeed: 0.015, phase: 0.0,  color: [29,155,240],  alpha: 0.38, width: 0.35 },
      { yBase: 0.38, amp: 0.11, phaseSpeed: 0.010, phase: 2.1,  color: [99,102,241],  alpha: 0.30, width: 0.40 },
      { yBase: 0.55, amp: 0.08, phaseSpeed: 0.018, phase: 4.2,  color: [20,184,166],  alpha: 0.20, width: 0.30 },
      { yBase: 0.12, amp: 0.06, phaseSpeed: 0.022, phase: 1.5,  color: [139,92,246],  alpha: 0.18, width: 0.25 },
    ];

    const isDark = () => document.documentElement.classList.contains("dark");
    let t = 0, animId = 0;
    let running = true;

    const draw = () => {
      if (!running) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const baseMult = isDark() ? 1.0 : 0.42;

      for (const band of bands) {
        band.phase += band.phaseSpeed;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const nx = i / 80;
          const ny = band.yBase
            + Math.sin(nx * Math.PI * 2.2 + band.phase) * band.amp
            + Math.sin(nx * Math.PI * 3.8 + band.phase * 1.4 + 1.2) * band.amp * 0.35;
          if (i === 0) ctx.moveTo(0, ny * H);
          else ctx.lineTo(nx * W, ny * H);
        }
        ctx.lineTo(W, H * (band.yBase + band.width + 0.08));
        ctx.lineTo(0, H * (band.yBase + band.width + 0.08));
        ctx.closePath();

        const [r, g, b] = band.color;
        const grd = ctx.createLinearGradient(0, H * (band.yBase - 0.06), 0, H * (band.yBase + band.width + 0.04));
        grd.addColorStop(0,    `rgba(${r},${g},${b},0)`);
        grd.addColorStop(0.18, `rgba(${r},${g},${b},${band.alpha * baseMult})`);
        grd.addColorStop(0.55, `rgba(${r},${g},${b},${band.alpha * 0.65 * baseMult})`);
        grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.filter = "blur(28px)";
        ctx.fill();
        ctx.restore();
      }

      // Drifting shimmer columns (slow, subtle)
      for (let i = 0; i < 5; i++) {
        const sx = ((i / 5) + t * 0.00004 * (i % 2 === 0 ? 1 : -0.6)) % 1;
        const [r, g, b] = bands[i % bands.length].color;
        const grd = ctx.createLinearGradient(sx * W, 0, sx * W, H * 0.6);
        grd.addColorStop(0,   `rgba(${r},${g},${b},0)`);
        grd.addColorStop(0.35,`rgba(${r},${g},${b},${0.055 * (isDark() ? 1 : 0.4)})`);
        grd.addColorStop(0.8, `rgba(${r},${g},${b},${0.025 * (isDark() ? 1 : 0.4)})`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.save();
        ctx.filter = "blur(10px)";
        ctx.fillStyle = grd;
        ctx.fillRect(sx * W - 25, 0, 50, H * 0.6);
        ctx.restore();
      }

      t++; animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [canvasRef, prefersReducedMotion, isVisible]);

  if (prefersReducedMotion) return null;

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

/* ─── STARS — Deep space: nebula clouds + stars + shooting stars ─ */
function StarsBackground() {
  const { containerRef, canvasRef, isVisible, prefersReducedMotion } = useCanvasVisibility();

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!isVisible) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    const isDark = () => document.documentElement.classList.contains("dark");

    // Dark-mode star colours / light-mode star colours
    const DARK_COLORS  = ["#ffffff","#e0f2fe","#ddd6fe","#fef9c3","#d1fae5"];
    const LIGHT_COLORS = ["#6366f1","#8b5cf6","#3b82f6","#0ea5e9","#14b8a6"];

    const STARS = Array.from({ length: 220 }, (_, i) => ({
      x: Math.random(), y: Math.random(),
      r: i < 140 ? Math.random() * 0.8 + 0.2 : i < 190 ? Math.random() * 1.2 + 0.8 : Math.random() * 1.8 + 1.2,
      alpha: Math.random() * 0.6 + 0.3,
      twinkleSpeed: Math.random() * 0.012 + 0.004,
      twinklePhase: Math.random() * Math.PI * 2,
      darkColor:  DARK_COLORS [Math.floor(Math.random() * DARK_COLORS.length)],
      lightColor: LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)],
      drift: (Math.random() - 0.5) * 0.00004,
    }));

    // Nebula blobs — drawn as simple radial gradients (no ctx.scale trick)
    const NEBULAE = [
      { cx: 0.15, cy: 0.22, r: 0.28, color: [99,102,241],  alpha: 0.13 },
      { cx: 0.80, cy: 0.15, r: 0.26, color: [139,92,246],  alpha: 0.11 },
      { cx: 0.50, cy: 0.65, r: 0.30, color: [29,155,240],  alpha: 0.09 },
      { cx: 0.75, cy: 0.55, r: 0.22, color: [236,72,153],  alpha: 0.08 },
      { cx: 0.25, cy: 0.75, r: 0.24, color: [20,184,166],  alpha: 0.07 },
    ];

    const shooters: { x:number; y:number; vx:number; vy:number; len:number; alpha:number; color:string }[] = [];
    let frame = 0, animId = 0;
    let running = true;

    const spawnShooter = () => {
      if (shooters.length >= 3) return;
      const angle = Math.PI / 5 + Math.random() * 0.4;
      const speed = 0.004 + Math.random() * 0.003;
      shooters.push({
        x: Math.random() * 0.75, y: Math.random() * 0.3,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        len: 0.08 + Math.random() * 0.06, alpha: 1.0,
        color: ["rgba(255,255,255","rgba(165,243,252","rgba(196,181,253"][Math.floor(Math.random() * 3)],
      });
    };

    const draw = () => {
      if (!running) return;
      const W = canvas.width, H = canvas.height;
      const dark = isDark();
      ctx.clearRect(0, 0, W, H);

      // Nebulae — simple radial gradient circles, blurred
      if (dark) {
        for (const neb of NEBULAE) {
          const rad = neb.r * Math.min(W, H);
          const grd = ctx.createRadialGradient(neb.cx*W, neb.cy*H, 0, neb.cx*W, neb.cy*H, rad);
          const [r,g,b] = neb.color;
          grd.addColorStop(0,   `rgba(${r},${g},${b},${neb.alpha})`);
          grd.addColorStop(0.5, `rgba(${r},${g},${b},${neb.alpha * 0.5})`);
          grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.save();
          ctx.filter = "blur(50px)";
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(neb.cx*W, neb.cy*H, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Stars
      for (const s of STARS) {
        s.x = (s.x + s.drift + 1) % 1;
        const twinkle = s.alpha * (0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed + s.twinklePhase));
        const finalAlpha = dark ? twinkle : twinkle * 0.40;
        const col = dark ? s.darkColor : s.lightColor;
        ctx.save();
        ctx.globalAlpha = finalAlpha;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = s.r * 3;
        ctx.fill();
        ctx.restore();
      }

      // Shooting stars (dark only)
      if (dark && frame % 180 === 0) spawnShooter();
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.alpha -= 0.008;
        if (sh.alpha <= 0 || sh.x > 1.1 || sh.y > 0.9) { shooters.splice(i, 1); continue; }
        const angle = Math.atan2(sh.vy, sh.vx);
        const tail = { x: sh.x - sh.len * Math.cos(angle), y: sh.y - sh.len * Math.sin(angle) };
        const grd = ctx.createLinearGradient(sh.x*W, sh.y*H, tail.x*W, tail.y*H);
        grd.addColorStop(0,   `${sh.color},${sh.alpha})`);
        grd.addColorStop(0.4, `${sh.color},${sh.alpha * 0.4})`);
        grd.addColorStop(1,   `${sh.color},0)`);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sh.x*W, sh.y*H);
        ctx.lineTo(tail.x*W, tail.y*H);
        ctx.strokeStyle = grd; ctx.lineWidth = 1.5;
        ctx.shadowColor = `${sh.color},0.8)`; ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sh.x*W, sh.y*H, 1.8, 0, Math.PI*2);
        ctx.fillStyle = `${sh.color},${sh.alpha})`;
        ctx.shadowBlur = 8; ctx.fill();
        ctx.restore();
      }

      frame++; animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [canvasRef, prefersReducedMotion, isVisible]);

  if (prefersReducedMotion) return null;

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

/* ─── EVO X — Organic lava-lamp blobs, evolution-x.org style ─── */
function EvoXBackground() {
  const { containerRef, canvasRef, isVisible, prefersReducedMotion } = useCanvasVisibility();

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!isVisible) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    const isDark = () => document.documentElement.classList.contains("dark");

    // Faster velocities so movement is clearly visible
    const blobs = [
      { x: 0.18, y: 0.22, r: 0.30, vx:  0.0012, vy:  0.0008, color: [220,38,38],   baseAlpha: 0.60 },
      { x: 0.78, y: 0.18, r: 0.26, vx: -0.0010, vy:  0.0011, color: [29,78,216],   baseAlpha: 0.55 },
      { x: 0.50, y: 0.72, r: 0.24, vx:  0.0008, vy: -0.0013, color: [139,92,246],  baseAlpha: 0.50 },
      { x: 0.12, y: 0.78, r: 0.22, vx:  0.0011, vy: -0.0007, color: [29,155,240],  baseAlpha: 0.42 },
      { x: 0.88, y: 0.60, r: 0.20, vx: -0.0009, vy:  0.0010, color: [236,72,153],  baseAlpha: 0.38 },
      { x: 0.42, y: 0.38, r: 0.18, vx:  0.0014, vy:  0.0006, color: [245,158,11],  baseAlpha: 0.33 },
    ];

    const phases       = blobs.map(() => Math.random() * Math.PI * 2);
    const breatheSpeeds = blobs.map(() => 0.018 + Math.random() * 0.012);

    let animId = 0;
    let running = true;
    const draw = () => {
      if (!running) return;
      const W = canvas.width, H = canvas.height;
      const dark = isDark();
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        // Smooth bounce
        if (b.x + b.r > 1.05 || b.x - b.r < -0.05) b.vx *= -1;
        if (b.y + b.r > 1.05 || b.y - b.r < -0.05) b.vy *= -1;
        b.x += b.vx; b.y += b.vy;
        phases[i] += breatheSpeeds[i];

        const breathe = 1 + 0.10 * Math.sin(phases[i]);
        const radius  = b.r * breathe * Math.min(W, H);
        const alpha   = b.baseAlpha * (dark ? 1.0 : 0.32) * (0.80 + 0.20 * Math.sin(phases[i] * 0.8));
        const [r, g, bl] = b.color;

        ctx.save();
        ctx.filter = `blur(${dark ? 60 : 48}px)`;
        const grd = ctx.createRadialGradient(b.x*W, b.y*H, 0, b.x*W, b.y*H, radius);
        grd.addColorStop(0,    `rgba(${r},${g},${bl},${alpha})`);
        grd.addColorStop(0.40, `rgba(${r},${g},${bl},${alpha * 0.50})`);
        grd.addColorStop(0.72, `rgba(${r},${g},${bl},${alpha * 0.15})`);
        grd.addColorStop(1,    `rgba(${r},${g},${bl},0)`);
        ctx.beginPath();
        ctx.arc(b.x*W, b.y*H, radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();
      }

      // Central glow (dark only)
      if (dark) {
        const grd = ctx.createRadialGradient(W*0.5, H*0.38, 0, W*0.5, H*0.38, W*0.22);
        grd.addColorStop(0, "rgba(255,255,255,0.028)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save(); ctx.filter = "blur(32px)";
        ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [canvasRef, prefersReducedMotion, isVisible]);

  if (prefersReducedMotion) return null;

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

// ── Main tab routes for swipe navigation ────────────────────────────────────
const SWIPE_ROUTES = ["/", "/community", "/search", "/leaderboard"];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { bgStyle } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  useScrollRestoration();

  // ── Swipe navigation state ────────────────────────────────────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  // Track navigation direction for page transition animations
  const prevPathRef = useRef(pathname);
  const [navDirection, setNavDirection] = useState(0); // -1 = left, 0 = none, 1 = right

  useEffect(() => {
    const prevIdx = SWIPE_ROUTES.indexOf(prevPathRef.current);
    const currIdx = SWIPE_ROUTES.indexOf(pathname);
    if (prevIdx !== -1 && currIdx !== -1 && prevIdx !== currIdx) {
      setNavDirection(currIdx > prevIdx ? 1 : -1);
    } else {
      setNavDirection(0);
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't trigger global swipe if user is interacting with scrollable areas, inputs, sliders, maps, or interactive canvases
    if (target.closest('input, textarea, select, .overflow-x-auto, [data-swipeable="true"], [role="slider"], .no-swipe, canvas, .leaflet-container')) {
      touchStartX.current = -1;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setSwipeDirection(null);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === -1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = Date.now() - touchStartTime.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Must be horizontal (ratio > 1.5), fast enough (< 400ms), and far enough (> 60px)
    if (absDx > 60 && absDx / (absDy + 1) > 1.5 && dt < 400) {
      const currentIdx = SWIPE_ROUTES.indexOf(pathname);
      if (currentIdx === -1) return;

      if (dx > 0 && currentIdx > 0) {
        // Swipe right → go to previous tab
        router.push(SWIPE_ROUTES[currentIdx - 1]);
      } else if (dx < 0 && currentIdx < SWIPE_ROUTES.length - 1) {
        // Swipe left → go to next tab
        router.push(SWIPE_ROUTES[currentIdx + 1]);
      }
    }
    setSwipeDirection(null);
  }, [pathname, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Base gradient */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex:0, background:"linear-gradient(180deg, var(--hero-bg-start) 0%, var(--hero-bg-mid) 30%, var(--hero-bg-end) 65%, rgb(var(--background)) 100%)" }} />
      {/* Subtle global holographic grid — adds cyberpunk ambience */}
      <div className="pointer-events-none fixed inset-0 holo-grid-bg opacity-[0.55]" style={{ zIndex:0 }} aria-hidden />
      {/* Radial vignette for focus */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, transparent 40%, rgb(var(--background) / 0.6) 100%)",
        }}
        aria-hidden
      />
      {bgStyle === "aurora" && <AuroraBackground />}
      {bgStyle === "stars"  && <StarsBackground />}
      {bgStyle === "evox"   && <EvoXBackground />}

      {/* Skip link — keyboard-only accessibility affordance. Hidden until focused,
          then jumps the user past the header/sidebar straight to the main content.
          Critical for screen-reader and keyboard users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <Header />
      <div className="relative flex flex-1" style={{ zIndex: 1 }}>
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            key={pathname}
            initial={{
              opacity: 0,
              x: navDirection === 0 ? 0 : navDirection > 0 ? 40 : -40,
              y: navDirection === 0 ? 12 : 0,
            }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
          >
            <ErrorBoundary boundaryName="main-route">
              {children}
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
      <BottomNav />
      <ScrollProgress />
      <CursorAura />
      <CommandPalette />
      <UsernameSetupModal />
      <SuspensionOverlay />
      <OnboardingTour />

      <ToastContainer />
    </div>
  );
}
