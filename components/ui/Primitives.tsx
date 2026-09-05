"use client";
import React from "react";
import { cn } from "@/lib/utils/cn";

export function Button({
  children,
  variant = "primary",
  className,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-chip px-4 py-2 text-sm font-medium font-head tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary:
      "bg-violet text-white shadow-glowSm hover:bg-violet-bright hover:shadow-glow active:scale-[0.98]",
    secondary:
      "bg-panel2 text-ink border border-line hover:border-violet/60 hover:text-violet-bright",
    ghost: "text-muted hover:text-ink hover:bg-panel2",
    danger: "bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30",
  } as const;
  return (
    <button className={cn(base, styles[variant], className)} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className, glow }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-panel/80 backdrop-blur-sm p-6",
        glow && "shadow-glowSm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "violet" }) {
  const tones = {
    neutral: "bg-panel2 text-muted border-line",
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    violet: "bg-violet/10 text-violet-bright border-violet/30",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-chip border px-2.5 py-1 text-xs font-mono uppercase tracking-wider", tones[tone])}>
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted/60 outline-none focus:border-violet focus:shadow-glowSm font-body",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted/60 outline-none focus:border-violet focus:shadow-glowSm font-body",
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted">{children}</label>;
}

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "violet" | "success" | "danger" }) {
  const toneClass = {
    neutral: "text-ink",
    violet: "text-violet-bright",
    success: "text-success",
    danger: "text-danger",
  } as const;
  return (
    <div className="rounded-lg border border-line bg-panel2/60 px-4 py-3">
      <div className="text-xs font-mono uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-xl", toneClass[tone])}>{value}</div>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-violet-bright">{eyebrow}</div>}
      <h1 className="font-display text-2xl md:text-3xl text-ink">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
    </div>
  );
}
