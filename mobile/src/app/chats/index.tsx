import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../../qu/hooks';
import { Avatar, Badge, ErrorNote, FacePile, Icon, Loading, Row, Screen, c, t } from '../../qu/ui';
import { fmtDuration, timeAgo } from '../../qu/format';

interface InboxRow {
  id: string; type: string; title: string; unread: number; archived: boolean; lastMessage: string | null; lastSender: string | null; lastMessageAt: string;
  expiresAt: string | null; members: { id: string; name: string; avatarColor: string }[]; avatar: { name: string; color: string }; event: { title: string } | null;
}

export default function ChatsScreen() {
  const { data, error, reload } = useData<{ meId: string; now: string; rows: InboxRow[] }>('/api/m/chats', 3000);
  if (!data) return <Screen title="Chats" back="/home">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const now = new Date(data.now);
  return <Screen title="Chats" back="/home" testID="chats-page">
    <View style={{ backgroundColor: c.surface, paddingVertical: 4, minHeight: 400 }}>
      {data.rows.map(r => {
        const squad = r.type === 'squad';
        const others = r.members.filter(m => m.id !== data.meId);
        const snippet = `${r.lastSender ? `${r.lastSender}: ` : ''}${r.lastMessage ?? 'Say hi'} · ${timeAgo(r.lastMessageAt, now)}`;
        return <Row key={r.id} testID={`inbox-row-${r.id}`} bold={r.unread > 0} onPress={() => router.push(`/chats/${r.id}`)}
          leading={<View>
            {squad ? <FacePile people={others.slice(0, 2)} size={40} max={2} /> : <Avatar name={r.avatar.name} color={r.avatar.color} size={56} character={r.type === 'direct'} />}
            {squad ? <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}><Icon name="users" size={10} color={c.surface} /></View> : null}
          </View>}
          title={<Text numberOfLines={1} style={r.unread ? t.bodyBold : [t.body]}>{r.title}{squad ? <Text style={t.meta}>  · Squad</Text> : null}</Text>}
          subtitle={<View>
            <Text numberOfLines={1} style={[t.meta, r.unread ? { color: c.ink } : null]}>{snippet}</Text>
            {squad && r.expiresAt ? <Text style={t.meta}>{r.event && !r.archived ? `${r.event.title} · ` : ''}{r.archived ? 'Chat ended' : `ends in ${fmtDuration(new Date(r.expiresAt).getTime() - now.getTime())}`}</Text> : null}
          </View>}
          trailing={<Badge count={r.unread} />} />;
      })}
      {data.rows.length === 0 ? <Text style={[t.meta, { textAlign: 'center', padding: 40 }]}>No chats yet.</Text> : null}
    </View>
  </Screen>;
}
