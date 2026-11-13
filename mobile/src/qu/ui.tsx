import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { asset } from './api';
import { useAppState, useMarkTabSeen, type BadgeKey } from './appstate';
import { characterUri } from './character';
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

/** "Hackathon prototype, not Facebook". On every screen, as on the web app (DESIGN.md 1.9). */
export function PrototypeLabel() {
  return <Text testID="prototype-label" style={{ height: 20, lineHeight: 20, backgroundColor: c.wash, textAlign: 'center', fontFamily: font.body, fontSize: 11, color: c.muted }}>Hackathon prototype, not Facebook</Text>;
}

/** Screen with Facebook's grey wash, a top bar and a scrolling stack of white sections. The tab bar shows unless `tabs={false}`. */
export function Screen({ title, back, children, right, scroll = true, testID, tabs = true, variant }: {
  title: string; back?: string | boolean; children: React.ReactNode; right?: React.ReactNode; scroll?: boolean; testID?: string; tabs?: boolean; variant?: 'home';
}) {
  return <View style={{ flex: 1, backgroundColor: c.wash }} testID={testID}>
    <TopBar title={title} back={back} right={right} variant={variant} />
    {scroll ? <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
    {tabs && <TabBar />}
    <ToastHost />
  </View>;
}

function RoundButton({ icon, label, onPress, badge, testID }: { icon: IconName; label: string; onPress?: () => void; badge?: number; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} new` : label} onPress={onPress}
    style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: pressed ? c.divider : c.control, alignItems: 'center', justifyContent: 'center' })}>
    <Icon name={icon} size={20} />
    {badge ? <View style={{ position: 'absolute', top: -4, right: -4 }}><CountBadge count={badge} /></View> : null}
  </Pressable>;
}

function MessagesButton() {
  const { badges } = useAppState();
  return <RoundButton icon="message-circle" label="Chats" testID="open-chats" badge={badges.chats ?? 0} onPress={() => router.push('/chats' as never)} />;
}

/**
 * 56px white top bar plus the prototype strip (components/fb/TopBar.tsx).
 * home: the Queue Up wordmark with Create, Search and Chats. Title only: page title with Search and Chats. back: chevron and title.
 */
export function TopBar({ title, back, right, variant }: { title: string; back?: string | boolean; right?: React.ReactNode; variant?: 'home' }) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((typeof back === 'string' ? back : '/events') as never);
  };
  return <View style={{ backgroundColor: c.surface }}>
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: back ? 4 : 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider, gap: 8 }}>
      {back ? <>
        <Pressable testID="back" accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevron-left" size={28} />
        </Pressable>
        <Text numberOfLines={1} accessibilityRole="header" style={[t.title, { flex: 1 }]}>{title}</Text>
        {right ? <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>{right}</View> : null}
      </> : variant === 'home' ? <>
        <Text accessibilityRole="header" accessibilityLabel="Queue Up home (prototype)" style={{ fontFamily: font.bold, fontSize: 22, letterSpacing: -0.4, color: c.ink, flex: 1 }}>Queue Up</Text>
        <RoundButton icon="plus" label="Create post" onPress={() => router.push('/home?compose=1' as never)} />
        <RoundButton icon="search" label="Search" />
        <MessagesButton />
      </> : <>
        <Text numberOfLines={1} accessibilityRole="header" style={[t.page, { flex: 1 }]}>{title}</Text>
        {right}
        <RoundButton icon="search" label="Search" />
        <MessagesButton />
      </>}
    </View>
    <PrototypeLabel />
  </View>;
}

const TABS: { key: BadgeKey; href: string; icon?: IconName; label: string }[] = [
  { key: 'home', href: '/home', icon: 'home', label: 'Home' },
  { key: 'video', href: '/video', icon: 'monitor', label: 'Video' },
  { key: 'friends', href: '/friends', icon: 'users', label: 'Friends' },
  { key: 'events', href: '/events', icon: 'calendar', label: 'Events' },
  { key: 'notifications', href: '/notifications', icon: 'bell', label: 'Notifications' },
  { key: 'profile', href: '/profile', label: 'Profile' },
];

/** Six equal tabs as on the web app (components/fb/TabBar.tsx): accent when active, red counts for news. */
export function TabBar() {
  const path = usePathname();
  const { badges, me } = useAppState();
  useMarkTabSeen();
  const active = TABS.find(x => path.startsWith(x.href))?.key ?? (/^\/(queue|squad|glance)/.test(path) ? 'events' : null);
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }}>
    {TABS.map(tab => {
      const on = tab.key === active;
      const n = badges[tab.key] ?? 0;
      return <Pressable key={tab.key} testID={`tab-${tab.key}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={n ? `${tab.label}, ${n} new` : tab.label}
        onPress={() => router.navigate(tab.href as never)} style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <View>
          {tab.icon ? <Icon name={tab.icon} size={22} color={on ? c.accent : c.muted} />
            : me ? <View testID="me-avatar" style={on ? { borderRadius: 14, borderWidth: 2, borderColor: c.accent } : undefined}><Avatar name={me.name} color={me.avatarColor} photoUrl={me.photoUrl} size={on ? 20 : 24} /></View>
            : <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.control }} />}
          {n > 0 ? <View style={{ position: 'absolute', top: -6, right: -10 }}><CountBadge count={n} testID={`badge-${tab.key}`} /></View> : null}
        </View>
        <Text style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11, color: on ? c.accent : c.muted }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

/** A red count, as on tab badges. */
export function CountBadge({ count, testID }: { count: number; testID?: string }) {
  return <View testID={testID} style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.badge, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: c.surface, boxSizing: 'content-box' } as ViewStyle}>
    <Text style={{ color: c.surface, fontFamily: font.bold, fontSize: 11, lineHeight: 13 }}>{count > 99 ? '99+' : count}</Text>
  </View>;
}

export function Section({ title, children, style, flush = false, testID }: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean; testID?: string }) {
  return <View testID={testID} style={[{ backgroundColor: c.surface, paddingHorizontal: flush ? 0 : 16, paddingVertical: 12 }, style]}>
    {title ? <Text accessibilityRole="header" style={[t.title, { marginBottom: 8, paddingHorizontal: flush ? 16 : 0 }]}>{title}</Text> : null}
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

/**
 * A person's circle: their photo, or their drawn character (components/fb/Avatar.tsx). `character={false}` is for
 * things (a squad chat, Queue Up itself): initials on the colour. `blurred` hides who it is until the squad is confirmed.
 */
export function Avatar({ name, color = c.accent, photoUrl, size = 40, blurred = false, dim = false, character = true }: {
  name: string; color?: string; photoUrl?: string | null; size?: number; blurred?: boolean; dim?: boolean; character?: boolean;
}) {
  const photo = !blurred && asset(photoUrl);
  const drawn = character && !photo;
  const uri = photo || (drawn ? characterUri(blurred ? 'hidden' : name, blurred ? c.muted : color) : null);
  return <View accessibilityRole="image" accessibilityLabel={blurred ? 'Hidden until your squad is confirmed' : name}
    style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: drawn ? c.control : color, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.5 : 1, ...(dim ? { filter: 'grayscale(1)' } : {}) } as ViewStyle}>
    {uri ? <Image source={{ uri }} style={[{ width: size, height: size }, blurred ? { filter: 'blur(3px)' } as never : null]} />
      : <Text style={[{ color: c.surface, fontFamily: font.semibold, fontSize: Math.round(size * 0.38) }, blurred ? { filter: 'blur(5px)' } as never : null]}>{initials(name)}</Text>}
  </View>;
}

export function FacePile({ people, size = 32, max = 4, blurred = false }: { people: { id: string; name: string; avatarColor?: string; photoUrl?: string | null }[]; size?: number; max?: number; blurred?: boolean }) {
  const shown = people.slice(0, max);
  return <View style={{ flexDirection: 'row' }}>
    {shown.map((p, i) => <View key={p.id} style={{ marginLeft: i ? -size * 0.3 : 0, borderRadius: size, borderWidth: 2, borderColor: c.surface }}>
      <Avatar name={p.name} color={p.avatarColor} photoUrl={p.photoUrl} size={size} blurred={blurred} />
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

/** Bottom sheet: scrim, white panel with rounded top corners, grabber, title and close (components/fb/Sheet.tsx). */
export function Sheet({ open, onClose, title, children, testID, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; testID?: string; footer?: React.ReactNode }) {
  if (!open) return null;
  return <Modal transparent visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <View testID={testID} accessibilityViewIsModal style={{ maxHeight: '88%', backgroundColor: c.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 16 }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.divider }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text accessibilityRole="header" style={t.headline}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 4 }}>{children}</ScrollView>
        {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
      </View>
    </View>
  </Modal>;
}

/** AI is labeled, not themed (DESIGN.md 1.8): a sparkle and plain words. */
export function AiLabel({ children = 'Written by AI', testID }: { children?: string; testID?: string }) {
  return <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Icon name="star" size={12} color={c.muted} /><Text style={t.meta}>{children}</Text>
  </View>;
}

const SOURCES: Record<string, string> = {
  live: 'Written by AI just now', cache: 'Saved AI response', mock: 'Test model', fallback: 'Template (AI unavailable)',
  template: 'Template', code: 'Checked by code', mixed: 'Partly AI, partly template',
};
/** Where one piece of output came from (lib/ai/status.ts describeSource). Nothing for an unknown source. */
export function AiSourceLabel({ source }: { source: string | null | undefined }) {
  const label = source ? SOURCES[source] : null;
  return label ? <AiLabel testID="ai-source">{label}</AiLabel> : null;
}
export function isAiSource(source: string | null | undefined) {
  return source === 'live' || source === 'cache' || source === 'mixed';
}

let toastMsg: string | null = null;
const toastListeners = new Set<() => void>();
/** A short message at the bottom of the screen for a few seconds. */
export function toast(msg: string) {
  toastMsg = msg;
  toastListeners.forEach(l => l());
  setTimeout(() => { if (toastMsg === msg) { toastMsg = null; toastListeners.forEach(l => l()); } }, 3000);
}
export function ToastHost() {
  const msg = React.useSyncExternalStore(l => { toastListeners.add(l); return () => { toastListeners.delete(l); }; }, () => toastMsg, () => toastMsg);
  if (!msg) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 72, alignItems: 'center' }}>
    <Text testID="toast" accessibilityLiveRegion="polite" style={{ backgroundColor: '#1c1e21', color: c.surface, fontFamily: font.semibold, fontSize: 15, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, overflow: 'hidden' }}>{msg}</Text>
  </View>;
}
