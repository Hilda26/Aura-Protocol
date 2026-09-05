"use client";
import { useEffect, useRef } from "react";

// Aura's own vocabulary falling through the background instead of generic
// matrix glyphs -- method names, verdict bands, and status strings straight
// out of contracts/Aura.py, so the effect reads as "this app's code is
// alive" rather than a generic cyberpunk skin.
const TOKENS = [
  "check_interval", "resolve_dispute", "dispute_check", "settle_check",
  "create_agreement", "accept_agreement", "reclaim_stalled_agreement",
  "DELIVERED", "MISSED", "INSUFFICIENT_DATA", "UPHOLD", "FLIP",
  "ACTIVE", "PENDING_SETTLEMENT", "DISPUTED", "COMPLETED",
  "gl.eq_principle", "gl.nondet.web.get", "0xA0F3", "0x8C71", "0x4D2E",
  "strike++", "bond_balance", "escrow_balance", "cadence_ok",
];

export function CodeRain({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let columns: { x: number; y: number; speed: number; token: string; nextTokenAt: number }[] = [];
    const fontSize = 13;

    function resize() {
      width = canvas!.width = canvas!.offsetWidth * devicePixelRatio;
      height = canvas!.height = canvas!.offsetHeight * devicePixelRatio;
      const colCount = Math.max(6, Math.floor(width / (fontSize * devicePixelRatio * 9)));
      columns = Array.from({ length: colCount }, (_, i) => ({
        x: (i + 0.5) * (width / colCount),
        y: Math.random() * -height,
        speed: (0.4 + Math.random() * 0.7) * devicePixelRatio,
        token: TOKENS[Math.floor(Math.random() * TOKENS.length)],
        nextTokenAt: Math.random() * height,
      }));
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      // Static, faint single frame -- no animation for reduced-motion users.
      ctx.fillStyle = "#05040A";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize * devicePixelRatio}px var(--font-mono, monospace)`;
      columns.forEach((c) => {
        ctx.fillStyle = "rgba(167,139,250,0.14)";
        ctx.fillText(c.token, c.x, height * 0.3 + c.y * 0.1);
      });
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    function frame() {
      ctx!.fillStyle = "rgba(5,4,10,0.15)";
      ctx!.fillRect(0, 0, width, height);
      ctx!.font = `${fontSize * devicePixelRatio}px var(--font-mono, monospace)`;
      for (const c of columns) {
        const nearBottom = c.y > height * 0.7;
        ctx!.fillStyle = nearBottom ? "rgba(192,132,252,0.55)" : "rgba(139,92,246,0.28)";
        ctx!.fillText(c.token, c.x, c.y);
        c.y += c.speed;
        if (c.y > c.nextTokenAt) {
          c.token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
          c.nextTokenAt = c.y + 40 + Math.random() * 120;
        }
        if (c.y > height + 40) {
          c.y = Math.random() * -200;
          c.speed = (0.4 + Math.random() * 0.7) * devicePixelRatio;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-70 ${className}`}
    />
  );
}
