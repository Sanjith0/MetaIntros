"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, House, MonitorPlay, Users } from "lucide-react";
import { useAppState, type BadgeKey } from "./AppState";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { cn } from "./cn";

const TABS: { key: BadgeKey; href: string; label: string; Icon?: typeof House }[] = [
  { key: "home", href: "/home", label: "Home", Icon: House },
  { key: "video", href: "/video", label: "Video", Icon: MonitorPlay },
  { key: "friends", href: "/friends", label: "Friends", Icon: Users },
  { key: "events", href: "/events", label: "Events", Icon: CalendarDays },
  { key: "notifications", href: "/notifications", label: "Notifications", Icon: Bell },
  { key: "profile", href: "/profile", label: "Profile" },
];

/** Paths where the tab bar steps aside (a chat thread owns the bottom edge). */
export function hidesTabBar(pathname: string) {
  return /^\/chats\/[^/]+/.test(pathname);
}

/**
 * Six equal tabs following the current app's bar, with Events taking a slot (the bar is customizable in the
 * real app). Active = accent icon + label; badges are red counts.
 */
export function TabBar() {
  const pathname = usePathname();
  const { badges, me } = useAppState();
  if (hidesTabBar(pathname)) return null;
  const active = TABS.find((t) => pathname.startsWith(t.href))?.key ?? (pathname.startsWith("/queue") || pathname.startsWith("/squad") ? "events" : null);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-divider/70 bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-6">
        {TABS.map(({ key, href, label, Icon }) => {
          const on = key === active;
          const n = badges[key] ?? 0;
          return (
            <li key={key}>
              <Link
                href={href}
                data-testid={`tab-${key}`}
                aria-current={on ? "page" : undefined}
                aria-label={n > 0 ? `${label}, ${n} new` : label}
                className={cn("flex h-[52px] flex-col items-center justify-center gap-0.5 text-tab", on ? "font-semibold text-accent" : "text-muted")}
              >
                <span className="relative">
                  {Icon ? (
                    <Icon size={24} strokeWidth={on ? 2.4 : 1.8} fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.12 : 0} aria-hidden />
                  ) : me ? (
                    <span data-testid="me-avatar"><Avatar name={me.name} color={me.avatarColor} size={24} className={cn(on && "ring-2 ring-accent ring-offset-1 ring-offset-surface")} /></span>
                  ) : (
                    <span className="block h-6 w-6 rounded-full bg-control" />
                  )}
                  {n > 0 && <Badge count={n} testId={`badge-${key}`} className="absolute -top-1.5 -right-2.5" />}
                </span>
                <span aria-hidden>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
