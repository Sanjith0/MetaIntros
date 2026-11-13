import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { setGlanceOrigin } from '../../qu/glanceOrigin';
import { hasWebView, redirectToGlanceEmbed } from '../../qu/glanceLaunch';

/**
 * Glance runs inside Link. It has no bar of its own: the event screen's back arrow leads back to the Link event
 * you pressed "Join with Glance" on (leaveGlance in qu/glanceOrigin.ts).
 */
export default function GlanceLayout() {
  const path = usePathname();
  const params = useGlobalSearchParams<{ source?: string; id?: string; title?: string }>();
  // Remember the Link event a join came from, so the back arrow can lead straight back to it.
  if (path.startsWith('/glance/join') && params.source === 'metaintros' && typeof params.id === 'string') setGlanceOrigin({ id: params.id, title: String(params.title ?? '') });
  // Phones never mount Glance's native screens (their capture needs the browser's face model): a deep link or any
  // other route into /glance goes to the embedded screen instead.
  const toEmbed = Platform.OS !== 'web' && hasWebView();
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => typeof v === 'string' ? [[k, v]] : [])).toString();
  const target = query ? `${path}?${query}` : path;
  useEffect(() => { if (toEmbed) redirectToGlanceEmbed(target); }, [toEmbed, target]);
  if (toEmbed) return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  return <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></View>;
}
