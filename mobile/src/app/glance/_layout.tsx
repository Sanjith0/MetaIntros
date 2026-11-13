import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { glanceOrigin, setGlanceOrigin } from '../../qu/glanceOrigin';

/**
 * Glance runs inside Link. Every Glance screen gets one bar on top that leads back to where you came
 * from: the Link event you pressed "Join with Glance" on, or Events.
 */
export default function GlanceLayout() {
  const path = usePathname();
  const params = useGlobalSearchParams<{ source?: string; id?: string; title?: string }>();
  // Remember the Link event a join came from, so the bar can lead straight back to it.
  if (path.startsWith('/glance/join') && params.source === 'metaintros' && typeof params.id === 'string') setGlanceOrigin({ id: params.id, title: String(params.title ?? '') });
  const origin = glanceOrigin();
  const back = () => router.navigate((origin ? `/events/${origin.id}` : '/events') as never);
  // Inside Link's phone app, Glance's web screens run in a WebView that already has Link's back bar.
  const embedded = Platform.OS === 'web' && typeof window !== 'undefined' && 'ReactNativeWebView' in window;
  if (embedded) return <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></View>;
  return <View style={{ flex: 1 }}>
    <Pressable testID="glance-back" accessibilityRole="button" accessibilityLabel={origin ? `Back to ${origin.title || 'the event'} in Link` : 'Back to Link'} onPress={back}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 12, backgroundColor: pressed ? '#e4e6eb' : '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ced0d4' })}>
      <Feather name="chevron-left" size={24} color="#0866ff" />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0866ff' }}>{origin ? `Back to ${origin.title || 'the event'}` : 'Back to Link'}</Text>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#65676b' }}>Glance</Text>
    </Pressable>
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  </View>;
}
