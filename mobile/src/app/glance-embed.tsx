import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { WEB_APP, hasWebView } from '../qu/glanceLaunch';
import { glanceOrigin } from '../qu/glanceOrigin';

/**
 * Glance inside Link on phones. Glance's face recognition is browser code (face-api + MediaPipe), so its screens
 * run in a WebView here, with the camera allowed, under Link's own back bar. The page hides its own bar when embedded.
 */
export default function GlanceEmbed() {
  const { path } = useLocalSearchParams<{ path?: string }>();
  const [loading, setLoading] = useState(true);
  const origin = glanceOrigin();
  const back = () => router.navigate((origin ? `/events/${origin.id}` : '/events') as never);
  const target = `${WEB_APP}/#${typeof path === 'string' && path.startsWith('/glance') ? path : '/glance/events'}`;
  // Loaded here, not at the top: builds without the native WebView must still open every other screen.
  const WebView = hasWebView() ? (require('react-native-webview') as typeof import('react-native-webview')).WebView : null;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
    <Pressable testID="glance-back" accessibilityRole="button" accessibilityLabel={origin ? `Back to ${origin.title || 'the event'} in Link` : 'Back to Link'} onPress={back}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 12, backgroundColor: pressed ? '#e4e6eb' : '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ced0d4' })}>
      <Feather name="chevron-left" size={24} color="#0866ff" />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0866ff' }}>{origin ? `Back to ${origin.title || 'the event'}` : 'Back to Link'}</Text>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#65676b' }}>Glance</Text>
    </Pressable>
    {WebView ? <View style={{ flex: 1 }}>
      <WebView source={{ uri: target }} style={{ flex: 1 }}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant" allowsBackForwardNavigationGestures
        originWhitelist={['https://*', 'http://*']} />
      {loading ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}><ActivityIndicator /></View> : null}
    </View> : <Text style={{ padding: 24, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#65676b' }}>This version of Link can&apos;t show Glance yet. Update the app.</Text>}
  </SafeAreaView>;
}
