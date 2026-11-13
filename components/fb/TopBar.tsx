"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeft, MessageCircle, Plus, Search } from "lucide-react";
import { useAppState } from "./AppState";
import { Badge } from "./Badge";
import { IconButton } from "./Button";
import { cn } from "./cn";

/** "Hackathon prototype, not Facebook". Required on every screen (DESIGN.md §1.9). */
export function PrototypeLabel({ className }: { className?: string }) {
  return (
    <p data-testid="prototype-label" className={cn("h-5 bg-wash text-center text-[11px] leading-5 text-muted", className)}>
      Hackathon prototype, not Facebook
    </p>
  );
}

function MessagesButton() {
  const { badges } = useAppState();
  const n = badges.chats ?? 0;
  return (
    <IconButton label={n ? `Chats, ${n} new` : "Chats"} href="/chats" data-testid="open-chats" badge={n > 0 ? <Badge count={n} testId="badge-chats" className="absolute -top-1 -right-1" /> : null}>
      <MessageCircle size={20} strokeWidth={2.2} />
    </IconButton>
  );
}

/**
 * 56px white top bar + the prototype strip, sticky.
 * - variant "home": our own neutral text logotype (not the Facebook wordmark) + Create, Search, Chats.
 * - title only: section variant (page title at left) + Search, Chats.
 * - back: chevron + truncated title + optional right actions. `back` is an href, or true for history back.
 */
export function TopBar({ variant, title, back, right, testId }: { variant?: "home"; title?: ReactNode; back?: string | true; right?: ReactNode; testId?: string }) {
  const router = useRouter();
  return (
    <header data-testid={testId} className="sticky top-0 z-30 bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-divider/60 px-4">
        {back ? (
          <>
            {back === true ? (
              <button type="button" onClick={() => router.back()} aria-label="Back" className="press -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-press">
                <ChevronLeft size={28} strokeWidth={2.2} />
              </button>
            ) : (
              <Link href={back} aria-label="Back" data-testid="back" className="press -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-press">
                <ChevronLeft size={28} strokeWidth={2.2} />
              </Link>
            )}
            <h1 className="min-w-0 flex-1 truncate text-title font-semibold">{title}</h1>
            {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
          </>
        ) : variant === "home" ? (
          <>
            <Link href="/home" className="text-[22px] leading-none font-bold tracking-tight text-ink" aria-label="Link home (prototype)">
              Link
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <IconButton label="Create post"><Plus size={20} strokeWidth={2.4} /></IconButton>
              <IconButton label="Search"><Search size={20} strokeWidth={2.4} /></IconButton>
              <MessagesButton />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-page font-bold">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              {right}
              <IconButton label="Search"><Search size={20} strokeWidth={2.4} /></IconButton>
              <MessagesButton />
            </div>
          </>
        )}
      </div>
      <PrototypeLabel />
    </header>
  );
}
