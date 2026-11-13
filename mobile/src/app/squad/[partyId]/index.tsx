import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { fmtEventWhen, fmtTime } from '../../../qu/format';
import { Avatar, Button, ErrorNote, FacePile, Icon, Loading, Row, Screen, Section, c, t, type IconName } from '../../../qu/ui';

interface Info {
  meId: string; partyId: string; name: string; status: string; chat: { id: string; archived: boolean } | null; sharePrompt: boolean; canLeave: boolean;
  event: { id: string; title: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string };
  members: { id: string; name: string; avatarColor: string; checkedIn: boolean; about: string | null; sample: boolean }[];
}

function Round({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ width: 80, alignItems: 'center', gap: 6 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} /></View>
    <Text style={[t.meta, { color: c.ink }]}>{label}</Text>
  </Pressable>;
}
const chevron = <Icon name="chevron-right" color={c.muted} />;

/** Squad info, modelled on Messenger's chat info. */
export default function SquadInfo() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data: p, error, reload } = useData<Info>(`/api/m/squad/${partyId}`);
  if (!p) return <Screen title="Squad info" back="/events">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const others = p.members.filter(m => m.id !== p.meId);
  const base = `/squad/${p.partyId}`;
  return <Screen title="Squad info" back={p.chat ? `/chats/${p.chat.id}` : '/events'} testID="squad-info-page">
    <Section style={{ alignItems: 'center', paddingTop: 20 }}>
      <FacePile people={others} size={56} max={3} />
      <Text style={[t.headline, { marginTop: 12 }]}>{p.name}</Text>
      <Text style={t.meta}>{p.members.length} people · {p.chat?.archived ? 'chat ended' : 'chat ends 24h after the event'}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {p.chat ? <Round label="Chat" icon="message-circle" onPress={() => router.push(`/chats/${p.chat!.id}`)} /> : null}
        <Round label="Event" icon="calendar" onPress={() => router.push(`/events/${p.event.id}`)} />
        <Round label="I'm here" icon="map-pin" onPress={() => router.push(`${base}/find`)} />
      </View>
    </Section>
    {p.status === 'completed' || p.chat?.archived ? <Section>
      <Text style={t.title}>Stay in touch</Text>
      <Text style={[t.meta, { marginVertical: 8 }]}>Add your squad as friends. Only mutual adds connect.</Text>
      <Button variant="primary" icon="user-plus" onPress={() => router.push(`${base}/connect`)}>Add your squad as friends</Button>
    </Section> : null}
    <Section flush title="Plan">
      <Row icon="calendar" title={p.event.title} subtitle={fmtEventWhen(p.event.startsAt, p.event.endsAt)} onPress={() => router.push(`/events/${p.event.id}`)} />
      <Row icon="map-pin" title={`Meet at the front entrance, ${p.event.venueName}`} subtitle={p.event.venueAddress} onPress={() => router.push(`${base}/find`)} trailing={chevron} />
      <Row icon="clock" title={`Doors at ${fmtTime(new Date(p.event.startsAt))}`} subtitle="Meet 10 minutes early so you can walk in together." />
    </Section>
    <Section flush>
      <Row icon="message-square" title="Talk cards" subtitle="What you have in common with each person" onPress={() => router.push(`${base}/cards`)} trailing={chevron} testID="open-talk-cards" />
      <Row icon="map-pin" title="Find each other" subtitle="Check in at the door and see who's here" onPress={() => router.push(`${base}/find`)} trailing={chevron} testID="open-find" />
      <Row icon="list" title="How we matched you" subtitle="What code checked, and what AI wrote" onPress={() => router.push(`${base}/trace`)} trailing={chevron} testID="open-trace" />
      <Row icon="user-plus" title="Stay in touch" subtitle="Add squadmates as friends after the event" onPress={() => router.push(`${base}/connect`)} trailing={chevron} />
    </Section>
    <Section flush title={`Members · ${p.members.length}`}>
      {p.members.map(u => <Row key={u.id} leading={<Avatar name={u.name} color={u.avatarColor} />} title={u.id === p.meId ? `${u.name} (you)` : u.name}
        subtitle={[u.checkedIn ? 'Here' : null, u.about, u.sample ? 'Sample person' : null].filter(Boolean).join(' · ') || undefined}
        onPress={u.id === p.meId ? undefined : () => router.push(`${base}/cards?member=${u.id}`)} trailing={u.id === p.meId ? null : chevron} />)}
    </Section>
    {p.canLeave ? <Section><Button onPress={async () => { await postJSON(`/api/squad/${p.partyId}/leave`); router.replace('/events'); }}>Leave squad</Button>
      <Text style={[t.meta, { textAlign: 'center', marginTop: 6 }]}>Nobody is told why.</Text></Section> : null}
  </Screen>;
}
