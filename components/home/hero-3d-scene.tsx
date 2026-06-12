"use client";

/**
 * RomX Hero 3D Scene — Pure three.js implementation.
 *
 * A cinematic "data core" — a holographic sphere at the center surrounded
 * by orbiting rings and floating device glyphs, connected by data streams.
 *
 * Design goals:
 *   • GPU-friendly (< 400 particles total, single canvas)
 *   • Responds to cursor parallax
 *   • Auto-pauses on visibility hidden (saves battery)
 *   • Reduced-motion-aware
 *   • Respects primary accent color via CSS variables
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Hero3DScene({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const visibleRef = useRef(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Respect reduced-motion preference
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Resolve primary accent from CSS variables (falls back to brand blue)
    const style = getComputedStyle(document.documentElement);
    const primaryHex = (style.getPropertyValue("--primary").trim() || "#1d9bf0").replace(/^rgb[a]?\([^)]*\)$/i, "#1d9bf0");
    let accent: THREE.Color;
    try { accent = new THREE.Color(primaryHex); } catch { accent = new THREE.Color("#1d9bf0"); }
    const accentB = new THREE.Color("#00e5ff");

    // ── Scene / Camera / Renderer ─────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x05060c, 0.12);

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    camera.position.set(0, 0, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Central Core — glowing icosahedron ─────────────────────
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const coreGeo = new THREE.IcosahedronGeometry(1.1, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(core);

    // Inner solid globe behind wireframe
    const innerGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.08,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(inner);

    // Point-cloud shell around core
    const pointCount = 260;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    for (let i = 0; i < pointCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.35 + Math.random() * 0.8;
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = Math.random() > 0.55 ? accentB : accent;
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    coreGroup.add(points);

    // ── Orbit rings ────────────────────────────────────────────
    const rings: THREE.Line[] = [];
    const makeRing = (radius: number, tilt: number, roll: number, color: THREE.Color, opacity: number) => {
      const segs = 128;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      const ring = new THREE.Line(geo, mat);
      ring.rotation.x = tilt;
      ring.rotation.z = roll;
      scene.add(ring);
      rings.push(ring);
      return ring;
    };
    const r1 = makeRing(1.9, Math.PI / 2.4, 0.15, accent, 0.35);
    const r2 = makeRing(2.6, Math.PI / 3.2, -0.2, accentB, 0.25);
    const r3 = makeRing(3.3, Math.PI / 2.0, 0.4, accent, 0.18);

    // ── Orbiting satellite glyphs (device markers) ─────────────
    type Satellite = { mesh: THREE.Mesh; radius: number; speed: number; phase: number; tilt: number; };
    const satellites: Satellite[] = [];
    const satConfig = [
      { radius: 1.9, speed: 0.25, color: accent,  scale: 0.14 },
      { radius: 1.9, speed: 0.25, color: accent,  scale: 0.12, phaseOffset: Math.PI },
      { radius: 2.6, speed: 0.18, color: accentB, scale: 0.14, phaseOffset: Math.PI / 2 },
      { radius: 2.6, speed: 0.18, color: accentB, scale: 0.12, phaseOffset: Math.PI * 1.5 },
      { radius: 3.3, speed: 0.12, color: accent,  scale: 0.11, phaseOffset: Math.PI / 3 },
      { radius: 3.3, speed: 0.12, color: accent,  scale: 0.10, phaseOffset: Math.PI * 1.2 },
    ];
    satConfig.forEach((s, idx) => {
      const g = new THREE.OctahedronGeometry(s.scale, 0);
      const m = new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(g, m);
      // Small outer halo
      const haloG = new THREE.SphereGeometry(s.scale * 1.6, 8, 8);
      const haloM = new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloG, haloM);
      mesh.add(halo);
      scene.add(mesh);
      satellites.push({
        mesh,
        radius: s.radius,
        speed: s.speed,
        phase: s.phaseOffset ?? (idx / satConfig.length) * Math.PI * 2,
        tilt: idx % 2 === 0 ? Math.PI / 2.4 : Math.PI / 3.2,
      });
    });

    // ── Data streams (additive lines) — far background ─────────
    const streamCount = 14;
    const streams: THREE.Line[] = [];
    for (let i = 0; i < streamCount; i++) {
      const geo = new THREE.BufferGeometry();
      const pts = new Float32Array(6); // 2 verts * 3
      const angle = (i / streamCount) * Math.PI * 2;
      pts[0] = Math.cos(angle) * 4.5;
      pts[1] = -2.5 + Math.random() * 5;
      pts[2] = Math.sin(angle) * 4.5;
      pts[3] = Math.cos(angle) * 2.2;
      pts[4] = pts[1] + (Math.random() - 0.5) * 0.5;
      pts[5] = Math.sin(angle) * 2.2;
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? accent : accentB,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.1,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      streams.push(line);
    }

    // ── Dynamic "data links" — glowing connection lines between
    // orbiting satellites and the core. Each link fades in/out in cycles.
    type Link = { line: THREE.Line; fromIdx: number; phaseOffset: number; cycle: number };
    const links: Link[] = [];
    const linkPairs: Array<[number, number]> = [
      [0, 2], [1, 4], [3, 5], [2, 5], [0, 4],
    ];
    linkPairs.forEach(([a], i) => {
      const pts = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? accentB : accent,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      links.push({
        line,
        fromIdx: a,
        phaseOffset: i * 0.9,
        cycle: 3 + Math.random() * 2,
      });
    });

    // ── Travelling "ping" particles along data links ──────────
    type Ping = { mesh: THREE.Mesh; linkIdx: number; progress: number; speed: number };
    const pings: Ping[] = [];
    const pingGeo = new THREE.SphereGeometry(0.05, 8, 8);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: i % 2 ? accent : accentB,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(pingGeo, m);
      mesh.scale.setScalar(1);
      scene.add(mesh);
      pings.push({ mesh, linkIdx: i % links.length, progress: i * 0.33, speed: 0.55 + Math.random() * 0.3 });
    }

    // ── Pointer parallax ───────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointerRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    mount.addEventListener("pointermove", onPointerMove, { passive: true });

    // ── Resize handling ────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const W = mount.clientWidth;
      const H = mount.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(mount);

    // ── Pause on hidden ────────────────────────────────────────
    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    // ── Animation loop ─────────────────────────────────────────
    const clock = new THREE.Clock();
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!visibleRef.current) return;

      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);

      // Smooth pointer
      if (!prefersReducedMotion) {
        pointerRef.current.x += (pointerRef.current.tx - pointerRef.current.x) * 0.06;
        pointerRef.current.y += (pointerRef.current.ty - pointerRef.current.y) * 0.06;
      }

      // Core rotation
      coreGroup.rotation.y += dt * 0.25;
      coreGroup.rotation.x += dt * 0.08;
      points.rotation.y -= dt * 0.12;

      // Pulsating inner globe
      const pulse = 1 + Math.sin(t * 1.8) * 0.05;
      inner.scale.setScalar(pulse);

      // Rings slow rotation
      r1.rotation.z += dt * 0.15;
      r2.rotation.z -= dt * 0.10;
      r3.rotation.z += dt * 0.06;

      // Satellites orbit
      satellites.forEach((s) => {
        const a = s.phase + t * s.speed;
        const ox = Math.cos(a) * s.radius;
        const oz = Math.sin(a) * s.radius;
        const oy = Math.sin(a * 2) * 0.15;
        // Tilt the orbit plane
        s.mesh.position.set(
          ox,
          oy + Math.sin(t * 0.6 + s.phase) * 0.1,
          oz * Math.cos(s.tilt),
        );
        s.mesh.rotation.x += dt * 0.8;
        s.mesh.rotation.y += dt * 0.5;
      });

      // Data streams fade
      streams.forEach((l, i) => {
        const m = l.material as THREE.LineBasicMaterial;
        m.opacity = 0.08 + (Math.sin(t * 1.5 + i) * 0.5 + 0.5) * 0.22;
      });

      // Dynamic data links — update endpoints to follow satellites
      links.forEach((lk, i) => {
        const sat = satellites[lk.fromIdx];
        if (!sat) return;
        const posAttr = lk.line.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        // Link endpoint = satellite position, origin = core center
        arr[0] = 0; arr[1] = 0; arr[2] = 0;
        arr[3] = sat.mesh.position.x;
        arr[4] = sat.mesh.position.y;
        arr[5] = sat.mesh.position.z;
        posAttr.needsUpdate = true;
        const m = lk.line.material as THREE.LineBasicMaterial;
        // Pulsing opacity cycle
        const phase = (t / lk.cycle + lk.phaseOffset) % 1;
        // 0..0.4 → fade in, 0.4..0.7 hold, 0.7..1 fade out
        const o =
          phase < 0.4 ? (phase / 0.4) * 0.55 :
          phase < 0.7 ? 0.55 :
          (1 - (phase - 0.7) / 0.3) * 0.55;
        m.opacity = Math.max(0, o);
      });

      // Travelling pings along links
      pings.forEach((p) => {
        p.progress += dt * p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.linkIdx = (p.linkIdx + 1) % links.length;
        }
        const lk = links[p.linkIdx];
        if (!lk) return;
        const sat = satellites[lk.fromIdx];
        if (!sat) return;
        // Lerp from core (0,0,0) to satellite position
        const k = p.progress;
        p.mesh.position.x = sat.mesh.position.x * k;
        p.mesh.position.y = sat.mesh.position.y * k;
        p.mesh.position.z = sat.mesh.position.z * k;
        const mm = p.mesh.material as THREE.MeshBasicMaterial;
        // Ping is brightest mid-flight, fades at ends
        mm.opacity = Math.sin(k * Math.PI) * 0.95;
        p.mesh.scale.setScalar(0.8 + Math.sin(k * Math.PI) * 0.9);
      });

      // Camera parallax
      camera.position.x = pointerRef.current.x * 0.7;
      camera.position.y = -pointerRef.current.y * 0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ────────────────────────────────────────────────
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVis);

      // Dispose all geometries + materials
      coreGeo.dispose();
      (coreMat as THREE.Material).dispose();
      innerGeo.dispose();
      (innerMat as THREE.Material).dispose();
      pGeo.dispose();
      (pMat as THREE.Material).dispose();
      rings.forEach((r) => {
        r.geometry.dispose();
        (r.material as THREE.Material).dispose();
      });
      satellites.forEach((s) => {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        s.mesh.children.forEach((c) => {
          const cm = c as THREE.Mesh;
          cm.geometry?.dispose();
          (cm.material as THREE.Material)?.dispose();
        });
      });
      streams.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
      links.forEach((lk) => {
        lk.line.geometry.dispose();
        (lk.line.material as THREE.Material).dispose();
      });
      pings.forEach((p) => {
        (p.mesh.material as THREE.Material).dispose();
      });
      pingGeo.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-hidden
      style={{ contain: "strict" }}
    />
  );
}
