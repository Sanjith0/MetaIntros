import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { asset } from './api';
import { fmtEventWhen } from './format';

/** Queue Up's Facebook-style tokens (app/globals.css on the web app). */
export const c = {
  accent: '#0866ff', link: '#0064d1', on: '#ebf5ff', ink: '#050505', muted: '#65676b', section: '#4b4c4f',
  disabled: '#bcc0c4', wash: '#f0f2f5', surface: '#ffffff', control: '#e4e6eb', divider: '#ced0d4',
  badge: '#e41e3f', date: '#f3425f', positive: '#31a24c', unread: '#e7f3ff', bubbleIn: '#f0f0f0',
};
export const font = { body: 'Inter_400Regular', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold', medium: 'Inter_500Medium' };
export type IconName = React.ComponentProps<typeof Feather>['name'];

export const t = StyleSheet.create({
  meta: { fontFamily: font.body, fontSize: 13, lineHeight: 16, color: c.muted },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 20, color: c.ink },
  bodyBold: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: c.ink },
  title: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, color: c.ink },
  headline: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, color: c.ink },
  page: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, color: c.ink },
  timer: { fontFamily: font.bold, fontSize: 34, lineHeight: 38, color: c.ink, fontVariant: ['tabular-nums'] },
  date: { fontFamily: font.semibold, fontSize: 13, lineHeight: 16, color: c.date, textTransform: 'uppercase' },
  link: { fontFamily: font.semibold, fontSize: 15, color: c.link },
});

export function Icon({ name, size = 20, color = c.ink }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} accessible={false} aria-hidden />;
}

/** Go to a path from the server (status card actions, etc.). */
export function go(href: string) {
  router.push(href as never);
}

/** Screen with Facebook's grey wash, a top bar and a scrolling stack of white sections. */
export function Screen({ title, back, children, right, scroll = true, testID, tabs = false }: {
  title: string; back?: string | boolean; children: React.ReactNode; right?: React.ReactNode; scroll?: boolean; testID?: string; tabs?: boolean;
}) {
  return <View style={{ flex: 1, backgroundColor: c.wash }} testID={testID}>
    <TopBar title={title} back={back} right={right} />
    {scroll ? <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
    {tabs && <TabBar />}
  </View>;
}

export function TopBar({ title, back, right }: { title: string; back?: string | boolean; right?: React.ReactNode }) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((typeof back === 'string' ? back : '/events') as never);
  };
  return <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: back ? 4 : 16, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider, gap: 4 }}>
    {back ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="chevron-left" size={26} />
    </Pressable> : null}
    <Text numberOfLines={1} accessibilityRole="header" style={[back ? t.title : { fontFamily: font.bold, fontSize: 24, color: c.ink }, { flex: 1 }]}>{title}</Text>
    {right}
  </View>;
}

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/home', icon: 'home', label: 'Home' },
  { href: '/events', icon: 'calendar', label: 'Events' },
  { href: '/chats', icon: 'message-circle', label: 'Chats' },
  { href: '/glance/events', icon: 'eye', label: 'Glance' },
  { href: '/notifications', icon: 'bell', label: 'Alerts' },
  { href: '/profile', icon: 'user', label: 'Profile' },
];

/** The bottom tab bar on the main screens. */
export function TabBar() {
  const path = usePathname();
  return <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, paddingBottom: 4 }}>
    {TABS.map(tab => {
      const on = tab.href.split('/')[1] === path.split('/')[1];
      return <Pressable key={tab.href} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.label}
        onPress={() => router.navigate(tab.href as never)} style={{ flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 2 }}>
        <Icon name={tab.icon} size={22} color={on ? c.accent : c.muted} />
        <Text style={{ fontFamily: font.medium, fontSize: 11, color: on ? c.accent : c.muted }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function Section({ title, children, style, flush = false, testID }: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean; testID?: string }) {
  return <View testID={testID} style={[{ backgroundColor: c.surface, paddingHorizontal: flush ? 0 : 16, paddingVertical: 12 }, style]}>
    {title ? <Text accessibilityRole="header" style={[t.headline, { marginBottom: 8, paddingHorizontal: flush ? 16 : 0 }]}>{title}</Text> : null}
    {children}
  </View>;
}

export function Button({ children, onPress, icon, variant = 'secondary', disabled, block = true, size = 'md', testID }: {
  children: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'on'; disabled?: boolean; block?: boolean; size?: 'md' | 'lg'; testID?: string;
}) {
  const bg = variant === 'primary' ? c.accent : variant === 'on' ? c.on : c.control;
  const fg = variant === 'primary' ? c.surface : variant === 'on' ? c.link : c.ink;
  return <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{
      minHeight: size === 'lg' ? 44 : 36, borderRadius: 6, paddingHorizontal: 12, backgroundColor: bg, flexDirection: 'row', gap: 6,
      alignItems: 'center', justifyContent: 'center', alignSelf: block ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
    }]}>
    {icon ? <Icon name={icon} size={16} color={fg} /> : null}
    <Text style={{ fontFamily: font.semibold, fontSize: 15, color: fg }}>{children}</Text>
  </Pressable>;
}

export function initials(name: string) {
  return name.split(/\s+/).map(w => w.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

export function Avatar({ name, color = c.accent, photoUrl, size = 40, blurred = false, dim = false }: { name: string; color?: string; photoUrl?: string | null; size?: number; blurred?: boolean; dim?: boolean }) {
  const src = !blurred && asset(photoUrl);
  return <View accessibilityRole="image" accessibilityLabel={blurred ? 'Hidden until your squad is confirmed' : name}
    style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: blurred ? c.control : color, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.5 : 1 }}>
    {src ? <Image source={{ uri: src }} style={{ width: size, height: size }} /> : blurred
      ? <Icon name="user" size={size * 0.5} color={c.muted} />
      : <Text style={{ color: c.surface, fontFamily: font.semibold, fontSize: Math.round(size * 0.38) }}>{initials(name)}</Text>}
  </View>;
}

export function FacePile({ people, size = 32, max = 4 }: { people: { id: string; name: string; avatarColor?: string; photoUrl?: string | null }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return <View style={{ flexDirection: 'row' }}>
    {shown.map((p, i) => <View key={p.id} style={{ marginLeft: i ? -size * 0.3 : 0, borderRadius: size, borderWidth: 2, borderColor: c.surface }}>
      <Avatar name={p.name} color={p.avatarColor} photoUrl={p.photoUrl} size={size} />
    </View>)}
    {people.length > max && <View style={{ marginLeft: -size * 0.3, width: size + 4, height: size + 4, borderRadius: size, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
      <Text style={t.meta}>+{people.length - max}</Text>
    </View>}
  </View>;
}

export function IconCircle({ name, on = false, size = 36 }: { name: IconName; on?: boolean; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? c.on : c.control, alignItems: 'center', justifyContent: 'center' }}>
    <Icon name={name} size={size / 2} color={on ? c.accent : c.ink} />
  </View>;
}

export function Cover({ color, src, height, aspect = 2, label }: { color: string; src?: string | null; height?: number; aspect?: number; label?: string }) {
  const uri = asset(src);
  return <View accessibilityRole="image" accessibilityLabel={label} style={[{ width: '100%', backgroundColor: color, overflow: 'hidden' }, height ? { height } : { aspectRatio: aspect }]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
  </View>;
}

export function DateLine({ start, end }: { start: string | Date; end?: string | Date | null }) {
  return <Text style={t.date}>{fmtEventWhen(start, end).replace(' · ', ' at ')}</Text>;
}

export function Row({ icon, leading, title, subtitle, onPress, trailing, bold, testID }: {
  icon?: IconName; leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; onPress?: () => void; trailing?: React.ReactNode; bold?: boolean; testID?: string;
}) {
  return <Pressable testID={testID} disabled={!onPress} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : 'transparent' }]}>
    {leading ?? (icon ? <IconCircle name={icon} /> : null)}
    <View style={{ flex: 1, minWidth: 0 }}>
      {typeof title === 'string' ? <Text numberOfLines={1} style={bold ? t.bodyBold : [t.body, { fontFamily: font.semibold }]}>{title}</Text> : title}
      {subtitle ? (typeof subtitle === 'string' ? <Text numberOfLines={2} style={[t.meta, bold && { color: c.ink, fontFamily: font.semibold }]}>{subtitle}</Text> : subtitle) : null}
    </View>
    {trailing}
  </Pressable>;
}

export function Progress({ value, max }: { value: number; max: number }) {
  return <View accessibilityRole="progressbar" style={{ height: 6, borderRadius: 3, backgroundColor: c.control, overflow: 'hidden' }}>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.accent, width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
  </View>;
}

export function Loading() {
  return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={c.accent} /></View>;
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry: () => void }) {
  return <Section><Text style={t.body}>Couldn&apos;t reach Queue Up ({error}).</Text><View style={{ height: 8 }} /><Button onPress={onRetry}>Try again</Button></Section>;
}

export function Badge({ count }: { count: number }) {
  if (!count) return null;
  return <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
    <Text style={{ color: c.surface, fontFamily: font.semibold, fontSize: 12 }}>{count}</Text>
  </View>;
}
