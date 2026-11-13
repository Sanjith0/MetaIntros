import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import Constants from 'expo-constants';
import glasses, { type GlassesState } from '../../modules/glance-glasses';
import { WEB_APP, glanceEmbedPath, hasWebView } from '../qu/glanceLaunch';
import { glanceOrigin } from '../qu/glanceOrigin';
import { GLASSES_SHIM } from '../qu/glassesShim';
import { c, font } from '../qu/ui';

/** Whether this build has Apple's Hotspot entitlement (app.config.js, LINK_GLASSES_HOTSPOT=1), which the glasses video needs. */
const HAS_HOTSPOT = (Constants.expoConfig?.extra as { linkGlassesHotspot?: boolean } | undefined)?.linkGlassesHotspot === true;

/** At most this many glasses frames a second go into the page; the shim drops any it can't draw in time. */
const FRAME_INTERVAL_MS = 1000 / 12;

/**
 * Glance inside Link on phones. Glance's face recognition is browser code (face-api + MediaPipe), so its screens
 * run in a WebView here, full screen with the camera allowed. There is no bar: the page's own back arrow on the
 * event screen posts {type: 'back'}, and this screen returns to the Link event Glance was opened from.
 *
 * Meta glasses: when this build has the GlanceGlasses module, the page gets the glasses camera shim
 * (qu/glassesShim.ts) and offers "Ray-Ban Meta" as a camera. The shim posts {channel: 'glasses', type: 'start' |
 * 'stop'}; frames from the glasses come back as JPEG and are pushed into the page.
 */
export default function GlanceEmbed() {
  const [loading, setLoading] = useState(true);
  const [path] = useState(glanceEmbedPath);
  const web = useRef<{ injectJavaScript(js: string): void } | null>(null);
  const back = () => {
    const origin = glanceOrigin();
    // dismissTo, not navigate: navigate pushes a second event page on top of Glance, whose own back arrow then
    // returns to Glance (a loop). dismissTo pops back to the event page already underneath, or replaces Glance with it.
    router.dismissTo((origin ? `/events/${origin.id}` : '/events') as never);
  };
  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);

  // Glasses frames, failures and pauses go straight into the page's shim.
  useEffect(() => {
    if (!glasses) return;
    let last = 0, frames = 0, videoPending = false;
    const subs = [
      glasses.addListener('onFrame', ({ data }) => {
        frames += 1;
        videoPending = false;
        if (frames === 1 || frames % 150 === 0) console.log(`[glasses] frame ${frames} (${Math.round(data.length / 1024)} KB)`);
        const now = Date.now();
        if (now - last < FRAME_INTERVAL_MS) return;
        last = now;
        run(`window.__glanceGlassesCamera && window.__glanceGlassesCamera.frame('${data}')`);
      }),
      glasses.addListener('onFailure', ({ message }) => { console.log(`[glasses] failure: ${message}`); }),
      // The page shows the glasses' own status when they send no video, instead of a generic timeout.
      glasses.addListener('onState', state => {
        console.log(`[glasses] state: ${state.status} (registered ${state.registered}, camera ${state.cameraAllowed}, streaming ${state.streaming})`);
        if (state.status.startsWith('Starting glasses video')) videoPending = true;
        if (state.streaming) videoPending = false;
        // The session started but video never came: Meta's SDK carries video over Wi-Fi (the glasses' own hotspot),
        // and joining it needs Apple's Hotspot entitlement, which a free Apple developer team cannot sign.
        const status = !(videoPending && !state.streaming) ? state.status
          : HAS_HOTSPOT ? 'the glasses connected, but their video link did not start. Video goes over the glasses\' Wi-Fi: check Wi-Fi is on, keep the glasses close, and retry'
          : 'the glasses connected, but their video link did not start. Video goes over the glasses\' Wi-Fi, which this build of Link cannot join without Apple\'s Hotspot permission (needs a paid Apple developer team; see mobile/docs/GLASSES.md)';
        run(`window.__linkGlassesStatus = ${JSON.stringify(status)}`);
      }),
      glasses.addListener('onFailure', ({ message }) => run(`window.__glanceGlassesCamera && window.__glanceGlassesCamera.failed(${JSON.stringify(message)})`)),
      glasses.addListener('onPause', ({ paused }) => run(`window.__glanceGlassesCamera && window.__glanceGlassesCamera.paused && window.__glanceGlassesCamera.paused(${paused ? 'true' : 'false'})`)),
    ];
    // Backgrounding stops the glasses camera; the page shows its normal retry state.
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'background') return;
      glasses?.stop();
      run(`window.__glanceGlassesCamera && window.__glanceGlassesCamera.failed(${JSON.stringify('The glasses camera stops while Link is in the background. Retry to continue.')})`);
    });
    return () => { subs.forEach(sub => sub.remove()); appState.remove(); glasses?.stop(); };
  }, []);

  const onMessage = (data: string) => {
    let message: { type?: string; channel?: string };
    try { message = JSON.parse(data) as typeof message; } catch { return; }
    if (message.channel === 'glasses') {
      console.log(`[glasses] page asked to ${message.type}`);
      if (message.type === 'start') void glasses?.start().catch((e: unknown) => console.log(`[glasses] start threw: ${String(e)}`));
      if (message.type === 'stop') glasses?.stop();
      return;
    }
    if (message.type === 'back') back();
  };
  const target = `${WEB_APP}/#${path.startsWith('/glance') ? path : '/glance/connections'}`;
  // Tells the page it is inside Link before its code runs (it hides web-only chrome and routes "back" here), and
  // adds the glasses camera when this build can stream it.
  const injected = `window.LINK_EMBED = true;${glasses ? `window.LINK_GLASSES = true;\n${GLASSES_SHIM}` : ''}\ntrue;`;
  // Loaded here, not at the top: builds without the native WebView must still open every other screen.
  const WebView = hasWebView()
    ? (require('react-native-webview') as { WebView: React.ComponentType<WebViewProps & React.RefAttributes<{ injectJavaScript(js: string): void }>> }).WebView
    : null;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
    {WebView ? <View style={{ flex: 1 }}>
      <WebView ref={web} source={{ uri: target }} style={{ flex: 1 }}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={(event: WebViewMessageEvent) => onMessage(event.nativeEvent.data)}
        javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant" allowsBackForwardNavigationGestures
        originWhitelist={['https://*', 'http://*']} />
      {loading ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}><ActivityIndicator /></View> : null}
      {glasses ? <GlassesButton /> : null}
    </View> : <Text style={{ padding: 24, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#65676b' }}>This version of Link can&apos;t show Glance yet. Update the app.</Text>}
  </SafeAreaView>;
}

/** Connect the Meta glasses: a small round button that opens the two setup steps and the glasses status. */
function GlassesButton() {
  const [open, setOpen] = useState(false);
  // A glasses problem must never take Glance down with it.
  const [state, setState] = useState<GlassesState | null>(() => { try { return glasses?.getState() ?? null; } catch { return null; } });
  useEffect(() => {
    if (!glasses) return;
    const sub = glasses.addListener('onState', setState);
    void glasses.refresh().then(setState, () => {});
    const appState = AppState.addEventListener('change', s => { if (s === 'active') void glasses?.refresh().then(setState, () => {}); });
    return () => { sub.remove(); appState.remove(); };
  }, []);
  if (!glasses || !state) return null;
  const dot = state.streaming ? c.positive : state.cameraAllowed ? c.accent : '#f7b928';
  const step = (label: string, done: boolean, onPress: () => void, disabled = false) =>
    <Pressable accessibilityRole="button" disabled={done || disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 36, borderRadius: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: done ? c.on : c.accent, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: done ? c.link : c.surface }}>{label}</Text>
    </Pressable>;
  return <View pointerEvents="box-none" style={{ position: 'absolute', right: 12, bottom: 24, left: 12, alignItems: 'flex-end', gap: 8 }}>
    {open ? <View style={{ alignSelf: 'stretch', backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 10,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: c.ink }}>Meta glasses</Text>
      <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: c.muted }}>{state.status}</Text>
      {step(state.registered ? 'Meta AI connected' : '1. Connect Meta AI', state.registered, () => { void glasses?.register(); })}
      {step(state.cameraAllowed ? 'Glasses camera allowed' : '2. Allow glasses camera', state.cameraAllowed, () => { void glasses?.allowCamera(); }, !state.registered)}
      <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: c.muted }}>Then pick Ray-Ban Meta as the camera when you scan or start a conversation. Frames stay on this iPhone and are never saved.</Text>
    </View> : null}
    <Pressable testID="glasses-button" accessibilityRole="button" accessibilityLabel={`Meta glasses: ${state.status}`} onPress={() => setOpen(v => !v)}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.8 : 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 })}>
      <Feather name={open ? 'x' : 'eye'} size={22} color={c.ink} />
      <View style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: dot, borderWidth: 2, borderColor: c.surface }} />
    </Pressable>
  </View>;
}
