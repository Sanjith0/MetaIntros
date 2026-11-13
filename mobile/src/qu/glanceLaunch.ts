import { Platform, TurboModuleRegistry } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from './api';
import { setGlanceOrigin } from './glanceOrigin';

/** Where the web build of this same app lives (it has Glance at /#/glance). */
export const WEB_APP = /^https?:/.test(API_BASE) ? API_BASE : 'https://queueup-expo.vercel.app';

/**
 * True on iOS and Android. Glance's face recognition (face-api + MediaPipe) only runs as browser code: the native
 * camera has no port of that model, and Expo Go has no capture module at all. So on phones Glance runs its web
 * screens, embedded in Link (a WebView screen with Link's own back bar) or, in an older build without the WebView
 * module, in an in-app browser sheet.
 */
export const glanceNeedsBrowser = Platform.OS !== 'web';

/** Whether this build has react-native-webview's native side (installs from before it was added don't). */
export function hasWebView(): boolean {
  if (Platform.OS === 'web') return false;
  try { return TurboModuleRegistry.get('RNCWebViewModule') != null; } catch { return false; }
}

/** The Link event a Glance path was opened from (join links carry it), for the way back. */
function rememberOrigin(path: string) {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  if (q.get('source') === 'metaintros' && q.get('id')) setGlanceOrigin({ id: q.get('id')!, title: q.get('title') ?? '' });
}

/** The Glance path the embedded screen opens next. Kept here, not in route params: params are decoded, so a title
 * with "&" in it would split the path. */
let pendingPath = '/glance/connections';
export const glanceEmbedPath = () => pendingPath;

/** On phones, show a Glance path in the embedded screen instead of mounting Glance's native screens (deep links). */
export function redirectToGlanceEmbed(path: string) {
  pendingPath = path;
  router.replace('/glance-embed' as never);
}

/** Open a Glance route: in the app on the web; embedded in Link on phones (browser sheet as a fallback). */
export function openGlance(path: string) {
  if (!glanceNeedsBrowser) { router.push(path as never); return; }
  rememberOrigin(path);
  if (hasWebView()) { pendingPath = path; router.push('/glance-embed' as never); return; }
  void WebBrowser.openBrowserAsync(`${WEB_APP}/#${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: 'done',
  });
}
