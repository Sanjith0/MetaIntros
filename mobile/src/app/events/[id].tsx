import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../qu/hooks';
import { postJSON } from '../../qu/api';
import { Button, Cover, DateLine, ErrorNote, FacePile, Icon, IconCircle, Loading, Screen, Section, c, font, t } from '../../qu/ui';
import { StatusCard, type StatusCardData } from '../../qu/StatusCard';

interface Detail {
  me: { id: string; name: string };
  event: { id: string; kind: string; title: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string; description: string; tags: string[]; isPublicVenue: boolean; coverColor: string; cover: string | null; myRsvp: string | null; goingCount: number; interestedCount: number; friendRsvps: { id: string; name: string; avatarColor: string; status: string }[] };
  card: StatusCardData | null; pulse: string | null;
}

/** "Join with Glance" stays in this app: Glance lives at /glance. */
export function glanceJoinHref(e: { id: string; title: string; venueName?: string | null }, name?: string | null) {
  const q = new URLSearchParams({ source: 'metaintros', id: e.id, title: e.title.trim().slice(0, 100) });
  const place = (e.venueName ?? '').trim().slice(0, 160);
  if (place) q.set('place', place);
  const n = (name ?? '').trim().slice(0, 80);
  if (n) q.set('name', n);
  return `/glance/join?${q.toString()}`;
}

function Rsvp({ eventId, value, onChange }: { eventId: string; value: string | null; onChange: () => void }) {
  const set = async (status: string) => { await postJSON(`/api/events/${eventId}/rsvp`, { status: value === status ? null : status }); onChange(); };
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    <View style={{ flex: 1 }}><Button variant={value === 'interested' ? 'on' : 'secondary'} icon="star" onPress={() => set('interested')}>Interested</Button></View>
    <View style={{ flex: 1 }}><Button variant={value === 'going' ? 'on' : 'secondary'} icon="check-circle" onPress={() => set('going')}>Going</Button></View>
  </View>;
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useData<Detail>(`/api/m/events/${encodeURIComponent(String(id))}`, 4000);
  if (!data) return <Screen title="Event" back="/events">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const e = data.event;
  const hangout = e.kind === 'hangout';
  const friendsGoing = e.friendRsvps.filter(f => f.status === 'going').length;
  return <Screen title={e.title} back="/events" testID="event-detail">
    <View style={{ backgroundColor: c.surface, paddingBottom: 12 }}>
      <Cover color={e.coverColor} src={e.cover} label={e.title} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 4 }}>
        <DateLine start={e.startsAt} end={e.endsAt} />
        <Text testID="event-title" style={t.page}>{e.title}</Text>
        <Text style={[t.body, { color: c.muted }]}>{e.venueName}</Text>
      </View>
      {!hangout ? <View style={{ paddingHorizontal: 16, marginTop: 12 }}><Rsvp eventId={e.id} value={e.myRsvp} onChange={reload} /></View> : null}
    </View>
    {hangout ? <Section><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconCircle name="map" on /><Text style={[t.body, { flex: 1 }]}>Planned for your squad. Only your squad can see it.</Text></View></Section> : null}
    {data.card ? <>
      <StatusCard card={data.card} onEventPage />
      {data.card.state === 'after' ? <Section><Button onPress={() => router.push('/queue/start')}>Find another squad</Button></Section> : null}
    </> : hangout ? null : e.isPublicVenue ? <Section testID="queue-entry">
      <Text style={t.headline}>Queue Up</Text>
      <Text style={[t.meta, { marginVertical: 8 }]}>{data.pulse ?? 'Go with a small squad of people you would get along with.'}</Text>
      <Button variant="primary" size="lg" icon="users" onPress={() => router.push(`/queue/start?eventId=${encodeURIComponent(e.id)}`)} testID="queue-entry-open">Find a squad for this event</Button>
    </Section> : <Section><Text style={t.meta}>Queue Up only works for events at public venues.</Text></Section>}
    {!hangout ? <Section title="Meet people with Glance" testID="glance-join">
      <Text style={[t.meta, { marginBottom: 12 }]}>See who else turned on Glance here, and get something to talk about when you meet.</Text>
      <Button icon="eye" onPress={() => router.push(glanceJoinHref(e, data.me.name) as never)} testID="glance-join-button">Join with Glance</Button>
    </Section> : null}
    <Section title="Details">
      <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
        <Icon name="map-pin" color={c.muted} />
        <View style={{ flex: 1 }}><Text style={t.bodyBold}>{e.venueName}</Text><Text style={t.meta}>{e.venueAddress}</Text></View>
      </View>
      <Text style={[t.body, { marginTop: 8 }]}>{e.description}</Text>
      {e.tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {e.tags.map(tag => <Text key={tag} style={[t.meta, { color: c.ink, fontFamily: font.semibold, backgroundColor: c.control, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }]}>{tag.replace(/[-_]/g, ' ')}</Text>)}
      </View> : null}
    </Section>
    {!hangout ? <Section title="Guests">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={t.headline}>{e.goingCount}</Text><Text style={t.meta}>Going</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={t.headline}>{e.interestedCount}</Text><Text style={t.meta}>Interested</Text></View>
      </View>
      {e.friendRsvps.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <FacePile people={e.friendRsvps} size={32} max={5} />
        <Text style={[t.meta, { flex: 1 }]}>{e.friendRsvps[0].name.split(' ')[0]}{e.friendRsvps.length > 1 ? ` and ${e.friendRsvps.length - 1} other friend${e.friendRsvps.length > 2 ? 's' : ''}` : ''}{friendsGoing === e.friendRsvps.length ? ' going' : ' interested'}</Text>
      </View> : null}
    </Section> : null}
  </Screen>;
}
