import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { Avatar, Button, ErrorNote, Loading, Row, Screen, Section, c, t } from '../qu/ui';
import { Chip } from '../qu/QueueSetup';

type U = { id: string; name: string; avatarColor: string };
interface Data {
  friends: (U & { work?: string | null; mutual: number; neighborhood?: string | null; queueLabel: string | null })[];
  requests: { incoming: { id: string; from: U; partyId: string | null }[]; outgoing: { id: string; to: U }[] };
  queueUp: { id: string; friend: U; event: { title: string } | null; sharedNote: string | null }[];
}
const TABS = [{ id: 'friends', label: 'Your friends' }, { id: 'requests', label: 'Requests' }, { id: 'queueup', label: 'Met through Queue Up' }];

export default function FriendsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(TABS.some(x => x.id === params.tab) ? params.tab! : 'friends');
  const { data, error, reload } = useData<Data>('/api/m/friends');
  const respond = async (requestId: string, accept: boolean) => { await postJSON('/api/friends/respond', { requestId, accept }); reload(); };
  return <Screen title="Friends" back="/profile" testID="friends-page">
    <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map(x => <Chip key={x.id} on={x.id === tab} onPress={() => setTab(x.id)}>{x.id === 'requests' && data?.requests.incoming.length ? `${x.label} (${data.requests.incoming.length})` : x.label}</Chip>)}
      </ScrollView>
    </View>
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : tab === 'friends' ? <Section flush title={`${data.friends.length} friends`}>
      {data.friends.map(f => <Row key={f.id} leading={<Avatar name={f.name} color={f.avatarColor} size={56} />} title={f.name}
        subtitle={f.queueLabel ? <Text style={[t.meta, { color: c.link }]}>{f.queueLabel}</Text> : [f.work, `${f.mutual} mutual friends`, f.neighborhood].filter(Boolean).join(' · ')}
        onPress={f.queueLabel ? () => router.push('/events') : undefined} />)}
    </Section> : tab === 'requests' ? <Section flush title="Friend requests">
      {data.requests.incoming.length === 0 && data.requests.outgoing.length === 0 ? <Text style={[t.meta, { textAlign: 'center', padding: 32 }]}>No pending requests</Text> : null}
      {data.requests.incoming.map(r => <View key={r.id} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Avatar name={r.from.name} color={r.from.avatarColor} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={t.bodyBold}>{r.from.name}</Text>
          {r.partyId ? <Text style={t.meta}>From your Queue Up squad</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="primary" onPress={() => respond(r.id, true)}>Confirm</Button></View>
            <View style={{ flex: 1 }}><Button onPress={() => respond(r.id, false)}>Delete</Button></View>
          </View>
        </View>
      </View>)}
      {data.requests.outgoing.map(r => <Row key={r.id} leading={<Avatar name={r.to.name} color={r.to.avatarColor} size={56} />} title={r.to.name} subtitle="Request sent" />)}
    </Section> : <Section flush title="Met through Queue Up">
      {data.queueUp.length === 0 ? <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
        <Text style={[t.meta, { textAlign: 'center' }]}>People you meet through a squad and both add will show up here.</Text>
        <Button block={false} onPress={() => router.push('/events')}>Find a squad</Button>
      </View> : null}
      {data.queueUp.map(q => <Row key={q.id} leading={<Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />} title={q.friend.name}
        subtitle={(q.event ? `Met through Queue Up · ${q.event.title}` : 'Met through Queue Up') + (q.sharedNote ? ` · You both love ${q.sharedNote}` : '')} />)}
    </Section>}
  </Screen>;
}
