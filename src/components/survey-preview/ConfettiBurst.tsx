import * as React from "react";
import { createPortal } from "react-dom";

/**
 * A one-shot confetti burst, drawn to a full-viewport canvas so the shower can
 * pass over the closing page's own content without pushing on layout. Skips
 * entirely under `prefers-reduced-motion` — nothing to reduce, so nothing to draw.
 *
 * Portaled to `document.body`: the preview drawer's slide-in animation puts
 * `will-change: transform` on its content wrapper, which — like an actual
 * transform — gives fixed-position descendants a containing block of that
 * wrapper instead of the viewport. Rendered inline, the canvas would be
 * clipped to the drawer's own bounds instead of covering the screen.
 */

const PARTICLE_COUNT = 140;
const DURATION_MS = 3200;
const COLORS = [
  "oklch(68% 0.19 250)",
  "oklch(75% 0.18 200)",
  "oklch(80% 0.18 140)",
  "oklch(78% 0.19 80)",
  "oklch(70% 0.22 25)",
  "oklch(72% 0.2 330)",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  tilt: number;
}

function createParticles(width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 3.2,
    vy: 2.5 + Math.random() * 3,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    tilt: Math.random() * Math.PI * 2,
  }));
}

export function ConfettiBurst() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = createParticles(window.innerWidth);
    const startedAt = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const fadeStart = DURATION_MS - 600;
      const opacity = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / 600) : 1;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.02;
        particle.rotation += particle.spin;
        particle.tilt += 0.05;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        const skew = Math.sin(particle.tilt);
        ctx.scale(1, skew * 0.6 + 0.4);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />,
    document.body
  );
}
