"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconChat, IconHome, IconSearch, IconSparkle } from "./icons";
import { UserSwitcher, type SwitcherPerson } from "./UserSwitcher";

/** 56px white bar: logo and search at left, nav in the centre, actions at
 *  right. Our own mark; no Meta logo, wordmark or icon. */
export function TopBar({ viewer, demo, others }: { viewer: SwitcherPerson; demo: SwitcherPerson[]; others: SwitcherPerson[] }) {
  const path = usePathname() ?? "";
  const active = path.startsWith("/chat") ? "chat" : path.startsWith("/party") ? "party" : path.startsWith("/event") ? "events" : "";
  const nav = [
    { href: "/events", label: "Events", icon: <IconCalendar size={24} />, key: "events" },
    { href: "/chat", label: "Chats", icon: <IconChat size={24} />, key: "chat" },
    { href: "/party", label: "Party", icon: <IconSparkle size={24} />, key: "party" },
  ];
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 bg-white px-4 shadow-[0_1px_2px_rgb(0_0_0/0.1)]">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/events" aria-label="pq, Party Queue home" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[17px] font-black lowercase tracking-tight text-white">
          pq
        </Link>
        <div className="hidden h-10 items-center gap-2 rounded-full bg-[var(--color-wash)] px-3 text-[var(--color-ink-2)] lg:flex lg:w-[240px]">
          <IconSearch size={16} />
          <span className="text-[15px]">Search</span>
        </div>
      </div>

      <nav className="flex h-14 items-stretch" aria-label="Main">
        <Link href="/events" className="hidden items-center px-6 text-[var(--color-ink-2)] hover:bg-black/5 md:flex" aria-label="Home">
          <IconHome size={24} />
        </Link>
        {nav.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            aria-label={n.label}
            aria-current={active === n.key ? "page" : undefined}
            className={`flex items-center px-4 sm:px-6 ${active === n.key ? "border-b-[3px] border-[var(--color-accent)] text-[var(--color-accent)]" : "text-[var(--color-ink-2)] hover:bg-black/5"} ${n.key === "party" && active !== "party" ? "text-[var(--color-pq)]" : ""}`}
          >
            {n.icon}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <span
          data-testid="prototype-label"
          className="hidden whitespace-nowrap rounded-full border border-[var(--color-divider)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)] sm:inline"
        >
          Hackathon prototype, not Facebook
        </span>
        <UserSwitcher viewer={viewer} demo={demo} others={others} />
      </div>
    </header>
  );
}

/** The label also shows on small screens, under the bar. */
export function MobilePrototypeLabel() {
  return (
    <div className="bg-[var(--color-btn-2)] py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)] sm:hidden">
      Hackathon prototype, not Facebook
    </div>
  );
}
