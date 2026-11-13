import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../../qu/hooks';
import { Button, Cover, DateLine, ErrorNote, Icon, Loading, Screen, Section, c, font, t } from '../../qu/ui';
import { StatusCard, type StatusCardData } from '../../qu/StatusCard';
import { Chip } from '../../qu/QueueSetup';

interface FeedEvent { id: string; title: string; startsAt: string; venueName: string; coverColor: string; cover: string | null; friendsInterested: number; goingCount: number; distanceKm: number | null; squad: boolean }
interface EventsData {
  tabs: { id: string; label: string }[]; tab: string; card: StatusCardData | null; showEntry: boolean; pulse: string | null;
  mySquads: { partyId: string; eventTitle?: string; title?: string; chatId?: string | null }[]; feed: FeedEvent[];
}

export function EventCard({ e }: { e: FeedEvent }) {
  return <Pressable testID={`event-card-${e.id}`} onPress={() => router.push(`/events/${e.id}`)}
    style={{ backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
    <Cover color={e.coverColor} src={e.cover} label={e.title} />
    <View style={{ padding: 12, gap: 2 }}>
      <DateLine start={e.startsAt} />
      <Text numberOfLines={2} style={t.title}>{e.title}</Text>
      <Text numberOfLines={1} style={t.meta}>{e.venueName}{e.distanceKm != null ? ` · ${e.distanceKm.toFixed(1)} km` : ''}</Text>
      <Text style={t.meta}>{e.friendsInterested > 0 ? `${e.friendsInterested} friend${e.friendsInterested === 1 ? '' : 's'} interested · ` : ''}{e.goingCount} going</Text>
      {e.squad ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 }}><Icon name="users" size={14} color={c.link} /><Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>Your squad is going</Text></View> : null}
    </View>
  </Pressable>;
}

export default function EventsScreen() {
  const [tab, setTab] = useState('foryou');
  const { data, error, reload } = useData<EventsData>(`/api/m/events?tab=${tab}`, 4000);
  const heading = ({ foryou: 'Suggested for you', nearby: 'Near you', weekend: 'This weekend' } as Record<string, string>)[tab];
  return <Screen title="Events" tabs testID="events-page">
    <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(data?.tabs ?? [{ id: 'foryou', label: 'For you' }]).map(f => <Chip key={f.id} on={f.id === tab} onPress={() => setTab(f.id)} testID={`feed-tab-${f.id}`}>{f.label}</Chip>)}
      </ScrollView>
    </View>
    {error && !data ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading /> : <>
      {data.card ? <StatusCard card={data.card} /> : null}
      {data.showEntry ? <Section testID="queue-entry">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.on, alignItems: 'center', justifyContent: 'center' }}><Icon name="users" color={c.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={t.bodyBold}>Queue Up</Text>
            <Text style={t.meta}>{data.pulse ?? 'Get matched with a small squad going together'}</Text>
          </View>
        </View>
        <Button variant="primary" icon="users" onPress={() => router.push('/queue/start')} testID="queue-entry-open">Find a squad</Button>
      </Section> : null}
      <Section title={heading}>
        <View style={{ gap: 12 }} testID="event-feed">
          {data.feed.map(e => <EventCard key={e.id} e={e} />)}
          {data.feed.length === 0 ? <Text style={[t.meta, { textAlign: 'center', paddingVertical: 24 }]}>No events here yet. Try another filter.</Text> : null}
        </View>
      </Section>
    </>}
  </Screen>;
}
