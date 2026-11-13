import { Platform } from 'react-native';
import { router } from 'expo-router';

/** The Link event a "Join with Glance" came from, for the way back. Memory only. */
let origin: { id: string; title: string } | null = null;
export const glanceOrigin = () => origin;
export function setGlanceOrigin(o: { id: string; title: string } | null) { origin = o; }

type EmbedWindow = { ReactNativeWebView?: { postMessage: (data: string) => void }; LINK_EMBED?: boolean };

/** True when this web page is Glance running inside Link's phone app (the WebView in app/glance-embed.tsx). */
export function inLinkEmbed(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const w = window as unknown as EmbedWindow;
  return Boolean(w.LINK_EMBED || w.ReactNativeWebView);
}

/**
 * Leave Glance for the Link event it was opened from (or Link's Events). Inside the phone app the page asks the
 * native screen to go; on the web, Glance and Link share one router.
 */
export function leaveGlance() {
  if (inLinkEmbed()) {
    (window as unknown as EmbedWindow).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'back' }));
    return;
  }
  router.navigate((origin ? `/events/${origin.id}` : '/events') as never);
}
