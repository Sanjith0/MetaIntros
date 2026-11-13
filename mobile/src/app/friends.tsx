import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { Avatar, Button, ErrorNote, Loading, Row, Screen, Section, c, font, t, toast } from '../qu/ui';
import { Chip } from '../qu/QueueSetup';

type U = { id: string; name: string; avatarColor: string };
interface Data {
  friends: (U & { work?: string | null; mutual: number; neighborhood?: string | null; queueLabel: string | null })[];
  requests: { incoming: { id: string; from: U; partyId: string | null }[]; outgoing: { id: string; to: U }[] };
  queueUp: { id: string; friend: U; event: { title: string } | null; sharedNote: string | null }[];
  suggestions: { id: string; user: U; mutual: number; squadmate?: boolean }[];
}
const TABS = [{ id: 'friends', label: 'Your friends' }, { id: 'requests', label: 'Requests' }, { id: 'queueup', label: 'Met through Link' }];

export default function FriendsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(TABS.some(x => x.id === params.tab) ? params.tab! : 'friends');
  const { data, error, reload } = useData<Data>('/api/m/friends');
  const respond = async (requestId: string, accept: boolean) => { await postJSON('/api/friends/respond', { requestId, accept }); reload(); };
  return <Screen title="Friends" testID="friends-page">
    <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map(x => <Chip key={x.id} testID={`friends-tab-${x.id}`} on={x.id === tab} onPress={() => setTab(x.id)}>{x.id === 'requests' && data?.requests.incoming.length ? `${x.label} (${data.requests.incoming.length})` : x.label}</Chip>)}
      </ScrollView>
    </View>
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : tab === 'friends' ? <>
    {data.suggestions.length ? <Section title="People you may know" testID="suggestions">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {data.suggestions.map(s => <View key={s.id} testID="suggestion" style={{ width: 144, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: '#e4e6eb' }}>
          <View style={{ alignItems: 'center', backgroundColor: c.wash, paddingVertical: 16 }}><Avatar name={s.user.name} color={s.user.avatarColor} size={72} /></View>
          <View style={{ padding: 8, gap: 2 }}>
            <Text numberOfLines={1} style={t.bodyBold}>{s.user.name}</Text>
            <Text numberOfLines={1} style={t.meta}>{s.squadmate ? 'From your squad' : `${s.mutual} mutual friends`}</Text>
            <View style={{ marginTop: 6 }}><Button variant="on" icon="user-plus" onPress={() => toast('Friend requests are off in this prototype.')}>Add friend</Button></View>
          </View>
        </View>)}
      </ScrollView>
    </Section> : null}
    <Section flush title={`${data.friends.length} friends`} testID="friends-list">
      {data.friends.map(f => <Row key={f.id} testID="friend-row" leading={<Avatar name={f.name} color={f.avatarColor} size={56} />} title={f.name}
        subtitle={f.queueLabel ? <Text testID="friend-queue-status" style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>{f.queueLabel}</Text> : [f.work, `${f.mutual} mutual friends`, f.neighborhood].filter(Boolean).join(' · ')}
        onPress={f.queueLabel ? () => router.push('/events') : undefined} />)}
    </Section></> : tab === 'requests' ? <Section flush title="Friend requests">
      {data.requests.incoming.length === 0 && data.requests.outgoing.length === 0 ? <Text style={[t.meta, { textAlign: 'center', padding: 32 }]}>No pending requests</Text> : null}
      {data.requests.incoming.map(r => <View key={r.id} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Avatar name={r.from.name} color={r.from.avatarColor} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={t.bodyBold}>{r.from.name}</Text>
          {r.partyId ? <Text style={t.meta}>From your Link squad</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button testID="request-confirm" variant="primary" onPress={() => respond(r.id, true)}>Confirm</Button></View>
            <View style={{ flex: 1 }}><Button testID="request-delete" onPress={() => respond(r.id, false)}>Delete</Button></View>
          </View>
        </View>
      </View>)}
      {data.requests.outgoing.map(r => <Row key={r.id} leading={<Avatar name={r.to.name} color={r.to.avatarColor} size={56} />} title={r.to.name} subtitle="Request sent" />)}
    </Section> : <Section flush title="Met through Link">
      {data.queueUp.length === 0 ? <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
        <Text style={[t.meta, { textAlign: 'center' }]}>People you meet through a squad and both add will show up here.</Text>
        <Button block={false} onPress={() => router.push('/events')}>Find a squad</Button>
      </View> : null}
      {data.queueUp.map(q => <Row key={q.id} leading={<Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />} title={q.friend.name}
        subtitle={(q.event ? `Met through Link · ${q.event.title}` : 'Met through Link') + (q.sharedNote ? ` · You both love ${q.sharedNote}` : '')} />)}
    </Section>}
  </Screen>;
}
