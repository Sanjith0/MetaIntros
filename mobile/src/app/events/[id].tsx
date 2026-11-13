import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../qu/hooks';
import { Button, Cover, DateLine, ErrorNote, FacePile, Icon, IconCircle, Loading, Screen, Section, c, font, t } from '../../qu/ui';
import { glanceNeedsBrowser, openGlance } from '../../qu/glanceLaunch';
import { StatusCard, type StatusCardData } from '../../qu/StatusCard';
import { ActionRow, FriendQueues, QueueEntry, type FriendQueue } from '../../qu/queueup';
import type { Landmark } from '../../qu/QueueSetup';

interface Detail {
  me: { id: string; name: string };
  event: { id: string; kind: string; title: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string; description: string; tags: string[]; isPublicVenue: boolean; coverColor: string; cover: string | null; myRsvp: string | null; goingCount: number; interestedCount: number; friendRsvps: { id: string; name: string; avatarColor: string; status: string }[] };
  card: StatusCardData | null; pulse: string | null; landmarks: Landmark[]; shareDefault: boolean; friendQueues: FriendQueue[]; nowMs: number;
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
      {!hangout ? <View style={{ paddingHorizontal: 16, marginTop: 12 }}><ActionRow eventId={e.id} initial={e.myRsvp} /></View> : null}
    </View>
    {hangout ? <Section testID="hangout-badge"><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconCircle name="map" on /><Text style={[t.body, { flex: 1 }]}>Planned for your squad. Only your squad can see it.</Text></View></Section> : null}
    {data.card ? <>
      <StatusCard card={data.card} onEventPage />
      {data.card.state === 'after' ? <Section><Button testID="find-another-squad" onPress={() => router.push('/events?queue=1')}>Find another squad</Button></Section> : null}
    </> : hangout ? null : e.isPublicVenue ? <QueueEntry pulse={data.pulse} landmarks={data.landmarks} shareDefault={data.shareDefault}
      event={{ id: e.id, title: e.title, startsAt: e.startsAt, venue: e.venueName, isPublic: e.isPublicVenue }}
      friendsInLine={data.friendQueues.filter(q => q.state === 'waiting').length} />
      : <Section testID="queue-up-private"><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="lock" size={16} color={c.muted} /><Text style={t.meta}>Link only works for events at public venues.</Text></View></Section>}
    {!hangout ? <FriendQueues queues={data.friendQueues} variant="list" nowMs={data.nowMs} eventTitle={e.title} /> : null}
    {!hangout ? <Section title="Meet people with Glance" testID="glance-join">
      <Button icon="eye" onPress={() => openGlance(glanceJoinHref(e, data.me.name))} testID="glance-join-button">Join with Glance</Button>
      <Text style={[t.meta, { marginTop: 8 }]}>See who else turned on Glance here. Your name and this event are filled in for you.{glanceNeedsBrowser ? ' Opens in a browser window so it can use your camera.' : ''}</Text>
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
    {!hangout ? <Section title="Guests" testID="guests">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={t.headline}>{e.goingCount}</Text><Text style={t.meta}>Going</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={t.headline}>{e.interestedCount}</Text><Text style={t.meta}>Interested</Text></View>
      </View>
      {e.friendRsvps.length ? <View testID="friend-rsvps" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <FacePile people={e.friendRsvps} size={32} max={5} />
        <Text style={[t.meta, { flex: 1 }]}>{e.friendRsvps[0].name.split(' ')[0]}{e.friendRsvps.length > 1 ? ` and ${e.friendRsvps.length - 1} other friend${e.friendRsvps.length > 2 ? 's' : ''}` : ''}{friendsGoing === e.friendRsvps.length ? ' going' : ' interested'}</Text>
      </View> : null}
    </Section> : null}
  </Screen>;
}
