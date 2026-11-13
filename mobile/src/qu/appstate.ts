import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { getJSON, postJSON } from './api';

export type BadgeKey = 'home' | 'video' | 'friends' | 'events' | 'notifications' | 'profile' | 'chats';
export type Badges = Partial<Record<BadgeKey, number>>;
export interface Me { id: string; name: string; avatarColor: string; photoUrl?: string | null }

/** Shell state shared by the top bar and tab bar (components/fb/AppState.tsx on the web app). */
let state: { me: Me | null; badges: Badges } = { me: null, badges: {} };
let active: BadgeKey | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const set = (next: Partial<typeof state>) => { state = { ...state, ...next }; emit(); };

export function badgeForPath(path: string): BadgeKey | null {
  for (const k of ['chats', 'notifications', 'friends', 'events', 'home', 'video', 'profile'] as BadgeKey[]) if (path.startsWith(`/${k}`)) return k;
  return null;
}

export async function refreshAppState() {
  try {
    const d = await getJSON<{ me: Me; badges: Badges }>('/api/m/me');
    set({ me: d.me, badges: active ? { ...d.badges, [active]: 0 } : d.badges });
  } catch { /* offline: keep what we have */ }
}

let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) { refreshAppState(); timer = setInterval(refreshAppState, 5000); }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}

export function useAppState() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Opening a tab marks it seen, so its badge clears (mounted once in the tab bar). */
export function useMarkTabSeen() {
  const path = usePathname();
  const tab = badgeForPath(path);
  useEffect(() => {
    active = tab;
    if (!tab) return;
    set({ badges: { ...state.badges, [tab]: 0 } });
    // Notifications marks itself seen after its first load, so this visit still shows what is new.
    if (tab !== 'notifications') markSeen(tab);
  }, [tab, path]);
}

export function markSeen(tab: BadgeKey) {
  postJSON<Badges>('/api/tabs/seen', { tab }).then(r => { if (r.ok && r.data) set({ badges: { ...r.data, [tab]: 0 } }); });
}
