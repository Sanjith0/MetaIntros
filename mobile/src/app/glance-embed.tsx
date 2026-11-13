import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WEB_APP, glanceEmbedPath, hasWebView } from '../qu/glanceLaunch';
import { glanceOrigin } from '../qu/glanceOrigin';

/**
 * Glance inside Link on phones. Glance's face recognition is browser code (face-api + MediaPipe), so its screens
 * run in a WebView here, full screen with the camera allowed. There is no bar: the page's own back arrow on the
 * event screen posts {type: 'back'}, and this screen returns to the Link event Glance was opened from.
 */
export default function GlanceEmbed() {
  const [loading, setLoading] = useState(true);
  const [path] = useState(glanceEmbedPath);
  const back = () => {
    const origin = glanceOrigin();
    router.navigate((origin ? `/events/${origin.id}` : '/events') as never);
  };
  const onMessage = (data: string) => {
    try { if ((JSON.parse(data) as { type?: string }).type === 'back') back(); } catch { /* not ours */ }
  };
  const target = `${WEB_APP}/#${path.startsWith('/glance') ? path : '/glance/connections'}`;
  // Loaded here, not at the top: builds without the native WebView must still open every other screen.
  const WebView = hasWebView() ? (require('react-native-webview') as typeof import('react-native-webview')).WebView : null;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
    {WebView ? <View style={{ flex: 1 }}>
      <WebView source={{ uri: target }} style={{ flex: 1 }}
        onLoadEnd={() => setLoading(false)}
        // Tells the page it is inside Link before its code runs (it hides web-only chrome and routes "back" here).
        injectedJavaScriptBeforeContentLoaded="window.LINK_EMBED = true; true;"
        onMessage={event => onMessage(event.nativeEvent.data)}
        javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant" allowsBackForwardNavigationGestures
        originWhitelist={['https://*', 'http://*']} />
      {loading ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}><ActivityIndicator /></View> : null}
    </View> : <Text style={{ padding: 24, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#65676b' }}>This version of Link can&apos;t show Glance yet. Update the app.</Text>}
  </SafeAreaView>;
}
