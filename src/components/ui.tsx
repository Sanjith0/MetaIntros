"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

export function Avatar({ p, size = 40, blurred = false, ring }: { p: Pick<Profile, "name" | "hue"> & { lastName?: string }; size?: number; blurred?: boolean; ring?: string }) {
  const initials = (p.name[0] + (p.lastName?.[0] ?? "")).toUpperCase();
  return (
    <div
      aria-label={blurred ? "Hidden until everyone accepts" : p.name}
      className="relative shrink-0 rounded-full overflow-hidden grid place-items-center text-white font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${p.hue} 75% 62%), hsl(${(p.hue + 40) % 360} 70% 45%))`,
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      <span style={{ filter: blurred ? "blur(6px)" : undefined }}>{initials}</span>
      {blurred && <div className="absolute inset-0 backdrop-blur-md bg-white/20" />}
    </div>
  );
}

export function MuseMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="mm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0866ff" />
          <stop offset=".5" stopColor="#7b3fe4" />
          <stop offset="1" stopColor="#e44fa4" />
        </linearGradient>
      </defs>
      <path fill="url(#mm)" d="M12 2l2.4 6.3L21 10l-6.6 1.7L12 18l-2.4-6.3L3 10l6.6-1.7z" />
      <circle cx="19" cy="19" r="2.2" fill="url(#mm)" />
    </svg>
  );
}

export function AiModeBadge() {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((d) => setMode(d.ai)).catch(() => setMode("mock"));
  }, []);
  if (!mode) return null;
  return (
    <span
      data-testid="ai-mode"
      title={mode === "muse" ? "Live Muse models" : "No API key: deterministic fallback matcher"}
      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${mode === "muse" ? "bg-violet-100 text-muse" : "bg-amber-100 text-amber-800"}`}
    >
      {mode === "muse" ? "Muse live" : "Mock AI"}
    </span>
  );
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-line/60 h-14 px-3 flex items-center gap-2">
      {back ? (
        <Link href={back} aria-label="Back" className="w-9 h-9 grid place-items-center rounded-full hover:bg-fbbg text-xl">
          ←
        </Link>
      ) : (
        <span className="text-fb font-bold text-[28px] tracking-tight leading-none">facebook</span>
      )}
      {title && <h1 className="font-semibold text-[17px] truncate">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
        <AiModeBadge />
      </div>
    </header>
  );
}

const tabs = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/events", label: "Events", icon: "▦" },
  { href: "/crews", label: "Crews", icon: "◎" },
  { href: "/glasses", label: "Glasses", icon: "◉" },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="sticky bottom-0 z-20 bg-white border-t border-line/60 grid grid-cols-4">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`py-2 flex flex-col items-center text-[11px] ${active === t.href ? "text-fb font-semibold" : "text-sub"}`}>
          <span className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white rounded-xl shadow-sm p-4 ${className}`}>{children}</section>;
}

export function Button({ children, onClick, variant = "primary", className = "", disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "muse" }) {
  const base = "h-10 px-4 rounded-lg font-semibold text-[15px] transition active:scale-[.98] disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-fb text-white hover:bg-fb-dark"
      : variant === "muse"
        ? "muse-shimmer text-white"
        : "bg-[#e4e6eb] text-ink hover:bg-[#d8dadf]";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}
