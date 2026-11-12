"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, ChevronLeft, House, Menu, MessageCircle, MonitorPlay, Plus, Search, Users } from "lucide-react";
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

export function TopBar({ title, back, right }: { title?: string; back?: string; right?: React.ReactNode }) {
  if (!back) {
    return (
      <header className="sticky top-0 z-20 bg-white h-14 px-4 flex items-center gap-2">
        <Link href="/" className="text-fb font-bold text-[30px] tracking-[-0.04em] leading-none" aria-label="Facebook home">
          facebook
        </Link>
        <AiModeBadge />
        <div className="ml-auto flex items-center gap-2">
          {right}
          <IconCircle label="Create"><Plus size={20} strokeWidth={2.6} /></IconCircle>
          <IconCircle label="Search"><Search size={20} strokeWidth={2.6} /></IconCircle>
          <IconCircle label="Messenger" href="/crews"><MessageCircle size={20} strokeWidth={2.6} /></IconCircle>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-line/50 h-12 px-1 flex items-center gap-1">
      <Link href={back} aria-label="Back" className="w-10 h-10 grid place-items-center rounded-full active:bg-fbbg">
        <ChevronLeft size={28} strokeWidth={2.2} />
      </Link>
      {title && <h1 className="font-bold text-[17px] truncate">{title}</h1>}
      <div className="ml-auto flex items-center gap-1 pr-2">
        {right}
        <AiModeBadge />
      </div>
    </header>
  );
}

function IconCircle({ children, label, href }: { children: React.ReactNode; label: string; href?: string }) {
  const cls = "w-9 h-9 rounded-full bg-[#e4e6eb] grid place-items-center text-ink";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>{children}</Link>
  ) : (
    <button aria-label={label} className={cls}>{children}</button>
  );
}

const tabs = [
  { href: "/", label: "Home", Icon: House },
  { href: "/video", label: "Video", Icon: MonitorPlay },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/events", label: "Events", Icon: CalendarDays },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/menu", label: "Menu", Icon: Menu },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="sticky bottom-0 z-20 bg-white border-t border-line/50 grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ href, label, Icon }) => {
        const on = active === href;
        return (
          <Link key={href} href={href} aria-label={label} className={`pt-2 pb-1.5 flex flex-col items-center gap-0.5 text-[10.5px] ${on ? "text-fb font-semibold" : "text-sub"}`}>
            <Icon size={24} strokeWidth={on ? 2.4 : 1.9} fill={on && label !== "Menu" ? "currentColor" : "none"} fillOpacity={on ? 0.15 : 0} />
            {label}
          </Link>
        );
      })}
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
