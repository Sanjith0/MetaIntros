"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLiveEvents } from "@/components/useLiveEvents";

export type BadgeKey = "home" | "video" | "friends" | "events" | "notifications" | "profile" | "chats";
export type Badges = Partial<Record<BadgeKey, number>>;
export interface Me { id: string; name: string; avatarColor: string }

const Ctx = createContext<{ badges: Badges; me: Me | null }>({ badges: {}, me: null });

/** Which badge a path clears when opened. */
export function badgeForPath(pathname: string): BadgeKey | null {
  if (pathname.startsWith("/chats")) return "chats";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/friends")) return "friends";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/video")) return "video";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

/** Shell state shared by TopBar and TabBar: the viewer and live badge counts. */
export function AppStateProvider({ me, initial, children }: { me: Me; initial: Badges; children: ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>(initial);
  const active = badgeForPath(pathname);

  // Opening a tab marks it seen → its badge clears.
  useEffect(() => {
    if (!active) return;
    setBadges((b) => ({ ...b, [active]: 0 }));
    fetch("/api/tabs/seen", { method: "POST", body: JSON.stringify({ tab: active }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Badges | null) => b && setBadges({ ...b, [active]: 0 }))
      .catch(() => {});
  }, [active, pathname]);

  const refresh = useCallback(
    () =>
      fetch("/api/badges")
        .then((r) => (r.ok ? r.json() : null))
        .then((b: Badges | null) => b && setBadges(active ? { ...b, [active]: 0 } : b))
        .catch(() => {}),
    [active],
  );
  useLiveEvents(["badges"], refresh);
  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return <Ctx.Provider value={{ badges, me }}>{children}</Ctx.Provider>;
}

export function useAppState() {
  return useContext(Ctx);
}
