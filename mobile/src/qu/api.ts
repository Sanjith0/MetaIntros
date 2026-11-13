import { Platform } from 'react-native';

/**
 * Where the Queue Up server is. On the web build it is the same site: Vercel forwards /api and
 * /images to the Queue Up server (vercel.json), so the session cookie stays first-party.
 * Native builds and local development set EXPO_PUBLIC_QUEUEUP_URL.
 */
const configured = (process.env.EXPO_PUBLIC_QUEUEUP_URL ?? '').trim().replace(/\/+$/, '');
export const API_BASE = configured || (Platform.OS === 'web' ? '' : 'http://localhost:3000');

/** A server path (e.g. "/images/covers/x.webp") as a full URL the app can load. */
export function asset(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:/.test(path) ? path : `${API_BASE}${path}`;
}

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

export async function postJSON<T = unknown>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!r) return { ok: false, status: 0, data: null };
  const data = (await r.json().catch(() => null)) as T | null;
  return { ok: r.ok, status: r.status, data };
}
