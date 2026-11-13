import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../qu/hooks';
import { Cover, DateLine, ErrorNote, Icon, Loading, Screen, Section, c, font, t } from '../../qu/ui';
import { openGlance } from '../../qu/glanceLaunch';
import { StatusCard, type StatusCardData } from '../../qu/StatusCard';
import { Chip, type Landmark } from '../../qu/QueueSetup';
import { CardActions, FriendQueues, MySquads, QueueEntry, type ActiveSquad, type FriendQueue, type PickableEvent } from '../../qu/queueup';

interface FeedEvent { id: string; title: string; startsAt: string; venueName: string; coverColor: string; cover: string | null; friendsInterested: number; goingCount: number; distanceKm: number | null; squad: boolean; myRsvp: string | null; ratedBoost: number }
interface EventsData {
  tabs: { id: string; label: string }[]; tab: string; card: StatusCardData | null; showEntry: boolean; again: boolean; also: boolean; pulse: string | null;
  mySquads: ActiveSquad[]; feed: FeedEvent[]; pickable: PickableEvent[]; landmarks: Landmark[]; shareDefault: boolean; friendQueues: FriendQueue[]; nowMs: number;
}
const RATED_FEED_LABEL_MIN = 0.4;

/** Facebook-style event card: cover, red date line, title, venue · distance, counts, Interested and share. */
export function EventCard({ e }: { e: FeedEvent }) {
  return <View style={{ backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
    <Pressable testID={`event-card-${e.id}`} onPress={() => router.push(`/events/${e.id}`)}>
      <Cover color={e.coverColor} src={e.cover} label={e.title} />
      <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 2 }}>
        <DateLine start={e.startsAt} />
        <Text numberOfLines={2} style={t.title}>{e.title}</Text>
        <Text numberOfLines={1} style={t.meta}>{e.venueName}{e.distanceKm != null ? ` · ${e.distanceKm.toFixed(1)} km` : ''}</Text>
        <Text testID="friends-interested" style={t.meta}>{e.friendsInterested > 0 ? `${e.friendsInterested} friend${e.friendsInterested === 1 ? '' : 's'} interested · ` : ''}{e.goingCount} going</Text>
        {!e.squad && e.ratedBoost >= RATED_FEED_LABEL_MIN ? <View testID="rated-reason" style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 }}><Icon name="star" size={14} color={c.muted} /><Text style={t.meta}>Like nights you rated highly</Text></View> : null}
        {e.squad ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 }}><Icon name="users" size={14} color={c.link} /><Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>Your squad is going</Text></View> : null}
      </View>
    </Pressable>
    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><CardActions eventId={e.id} initial={e.myRsvp} /></View>
  </View>;
}

export default function EventsScreen() {
  const params = useLocalSearchParams<{ queue?: string }>();
  const [tab, setTab] = useState('foryou');
  const { data, error, reload } = useData<EventsData>(`/api/m/events?tab=${tab}`, 4000);
  const heading = ({ foryou: 'Suggested for you', nearby: 'Near you', weekend: 'This weekend' } as Record<string, string>)[tab];
  return <Screen title="Events" testID="events-page">
    <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(data?.tabs ?? [{ id: 'foryou', label: 'For you' }]).map(f => <Chip key={f.id} on={f.id === tab} onPress={() => setTab(f.id)} testID={`feed-tab-${f.id}`}>{f.label}</Chip>)}
      </ScrollView>
    </View>
    {error && !data ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading /> : <>
      {data.card ? <StatusCard card={data.card} /> : null}
      {data.mySquads.length ? <MySquads squads={data.mySquads} /> : null}
      {data.showEntry ? <QueueEntry pulse={data.pulse} events={data.pickable} landmarks={data.landmarks} shareDefault={data.shareDefault} again={data.again} also={data.also} autoOpen={params.queue === '1'} /> : null}
      <FriendQueues queues={data.friendQueues} nowMs={data.nowMs} />
      <Section title={heading}>
        <View style={{ gap: 12 }} testID="event-feed">
          {data.feed.map(e => <EventCard key={e.id} e={e} />)}
          {data.feed.length === 0 ? <Text style={[t.meta, { textAlign: 'center', paddingVertical: 24 }]}>No events here yet. Try another filter.</Text> : null}
        </View>
      </Section>
    </>}
  </Screen>;
}

/** Glance lives inside this app now: one quiet row on Events, beside the event page's "Join with Glance".
 * Hidden for now (not rendered); put <GlanceEntry /> back above the feed to show it. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GlanceEntry() {
  return <Pressable testID="glance-entry" onPress={() => openGlance('/glance/connections')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name="eye" /></View>
    <View style={{ flex: 1 }}><Text style={t.bodyBold}>Glance</Text><Text style={t.meta}>People you met with Glance</Text></View>
    <Icon name="chevron-right" color={c.muted} />
  </Pressable>;
}
