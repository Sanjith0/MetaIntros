import React, { useEffect, useRef } from 'react';
import { markSeen } from '../qu/appstate';
import { Text, View } from 'react-native';
import { useData } from '../qu/hooks';
import { timeAgo } from '../qu/format';
import { Avatar, ErrorNote, Icon, Loading, Row, Screen, c, font, go, t, type IconName } from '../qu/ui';

interface Item { id: string; kind: string; bold: string; text: string; href: string; at: string; avatar: { name: string; color: string }; unread: boolean; photoUrl?: string | null }
const KIND: Record<string, { icon: IconName; tone: string }> = {
  squad: { icon: 'users', tone: c.accent }, chat_ended: { icon: 'message-circle', tone: c.muted }, request: { icon: 'user-plus', tone: c.accent },
  met: { icon: 'users', tone: c.positive }, reminder: { icon: 'calendar', tone: c.date }, friend_queue: { icon: 'users', tone: c.accent },
  group_invite: { icon: 'user-plus', tone: c.accent }, squad_post: { icon: 'image', tone: c.positive },
};

/** These picture Queue Up or an event, not a person: initials (or the event's photo), not a character. */
const THINGS = new Set(['squad', 'chat_ended', 'reminder']);

export default function NotificationsScreen() {
  const { data, error, reload } = useData<{ now: string; items: Item[] }>('/api/m/notifications', 5000);
  // What was new when this visit started stays highlighted while it lasts (seen is read before it is marked).
  const fresh0 = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data || fresh0.current) return;
    fresh0.current = new Set(data.items.filter(n => n.unread).map(n => n.id));
    markSeen('notifications');
  }, [data]);
  if (!data) return <Screen title="Notifications" tabs>{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const now = new Date(data.now);
  const isNew = (n: Item) => n.unread || !!fresh0.current?.has(n.id);
  const items = data.items.map(n => ({ ...n, unread: isNew(n) }));
  const fresh = items.filter(n => n.unread), earlier = items.filter(n => !n.unread);
  const render = (n: Item) => {
    const k = KIND[n.kind] ?? KIND.squad;
    return <View key={n.id} style={{ backgroundColor: n.unread ? c.unread : c.surface }}>
      <Row testID={`notif-${n.kind}`} onPress={() => go(n.href)}
        leading={<View><Avatar name={n.avatar.name} color={n.avatar.color} size={56} character={!THINGS.has(n.kind)} photoUrl={n.photoUrl} />
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: k.tone, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}><Icon name={k.icon} size={12} color={c.surface} /></View></View>}
        title={<Text style={t.body}><Text style={t.bodyBold}>{n.bold}</Text> {n.text}</Text>}
        subtitle={<Text style={[t.meta, n.unread && { color: c.link, fontFamily: font.semibold }]}>{timeAgo(n.at, now)}</Text>}
        trailing={n.unread ? <View accessibilityLabel="New" style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.accent }} /> : null} />
    </View>;
  };
  return <Screen title="Notifications" tabs testID="notifications-page">
    <View style={{ backgroundColor: c.surface, minHeight: 400 }}>
      {fresh.length ? <><Text style={[t.title, { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }]}>New</Text>{fresh.map(render)}</> : null}
      {earlier.length ? <><Text style={[t.title, { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }]}>Earlier</Text>{earlier.map(render)}</> : null}
      {data.items.length === 0 ? <Text style={[t.meta, { textAlign: 'center', padding: 40 }]}>You&apos;re all caught up.</Text> : null}
    </View>
  </Screen>;
}
