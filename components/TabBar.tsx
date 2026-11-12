"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, House, MessageCircle, UserRound, Users } from "lucide-react";
import { useLiveEvents } from "./useLiveEvents";

type Tab = "home" | "events" | "friends" | "chats" | "profile";
type Badges = Record<Tab, number>;

const TABS: { tab: Tab; href: string; label: string; Icon: typeof House }[] = [
  { tab: "home", href: "/home", label: "Home", Icon: House },
  { tab: "events", href: "/events", label: "Events", Icon: CalendarDays },
  { tab: "friends", href: "/friends", label: "Friends", Icon: Users },
  { tab: "chats", href: "/chats", label: "Chats", Icon: MessageCircle },
  { tab: "profile", href: "/profile", label: "Profile", Icon: UserRound },
];

export function TabBar({ initial }: { initial: Badges }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>(initial);
  const active = TABS.find((t) => pathname.startsWith(t.href))?.tab;

  // Opening a tab marks it seen → its badge clears.
  useEffect(() => {
    if (!active) return;
    setBadges((b) => ({ ...b, [active]: 0 }));
    fetch("/api/tabs/seen", { method: "POST", body: JSON.stringify({ tab: active }) })
      .then((r) => r.json())
      .then((b: Badges) => setBadges({ ...b, [active]: 0 }))
      .catch(() => {});
  }, [active, pathname]);

  const refresh = () =>
    fetch("/api/badges")
      .then((r) => r.json())
      .then((b: Badges) => setBadges(active ? { ...b, [active]: 0 } : b))
      .catch(() => {});

  useLiveEvents(["badges"], refresh);
  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-fb-divider bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {TABS.map(({ tab, href, label, Icon }) => {
          const on = tab === active;
          const n = badges[tab] ?? 0;
          return (
            <li key={tab}>
              <Link
                href={href}
                data-testid={`tab-${tab}`}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-fb-blue" : "text-fb-muted"}`}
              >
                {on && <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-fb-blue" />}
                <span className="relative">
                  <Icon size={24} strokeWidth={on ? 2.4 : 1.8} />
                  {n > 0 && (
                    <span
                      data-testid={`badge-${tab}`}
                      className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-[#e41e3f] px-1 text-center text-[11px] font-bold leading-[18px] text-white"
                    >
                      {n > 9 ? "9+" : n}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
