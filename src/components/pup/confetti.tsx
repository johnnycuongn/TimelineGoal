import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const COUNT = 90;
const DURATION_MS = 1200;
const GRAVITY = 1800;
const COLORS = ["#be185d", "#ec4899", "#f9a8d4", "#0d9488", "#fbbf24", "#818cf8"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  w: number;
  h: number;
}

export default function Confetti({ burst }: { burst: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = canvas.current;
    if (burst === 0 || reduced || !el) {
      return;
    }
    const ctx = el.getContext("2d");
    if (!ctx) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = el.clientWidth * dpr;
    el.height = el.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = el.clientWidth;
    const h = el.clientHeight;
    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 500 + Math.random() * 500;
      return {
        x: w / 2,
        y: h * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#be185d",
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
      };
    });
    let start = 0;
    let last = 0;
    let frame = 0;
    const step = (t: number) => {
      if (!start) {
        start = t;
        last = t;
      }
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, w, h);
      const alpha = 1 - (t - start) / DURATION_MS;
      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - start < DURATION_MS) {
        frame = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [burst, reduced]);
  // Purely decorative. The spec asked for role="presentation", which Biome
  // rejects on an interactive element like <canvas>; aria-hidden says the same
  // thing about a decoration, and tabIndex={-1} keeps this hidden overlay out of
  // the tab order so nothing focusable is hidden from a screen reader.
  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      ref={canvas}
      tabIndex={-1}
    />
  );
}
