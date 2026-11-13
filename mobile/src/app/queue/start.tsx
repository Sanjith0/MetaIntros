import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../qu/hooks';
import { ErrorNote, Loading, Screen } from '../../qu/ui';
import { QueueSetup, type Landmark } from '../../qu/QueueSetup';

interface Detail { event: { id: string; kind: string; title: string; startsAt: string; venueName: string; isPublicVenue: boolean }; landmarks: Landmark[]; shareDefault: boolean }
interface EventsData { landmarks: Landmark[]; shareDefault: boolean }

export default function QueueStart() {
  const { eventId, mode } = useLocalSearchParams<{ eventId?: string; mode?: string }>();
  const path = eventId ? `/api/m/events/${encodeURIComponent(eventId)}` : '/api/m/events';
  const { data, error, reload } = useData<Detail & EventsData>(path);
  const ev = data?.event && data.event.kind === 'event' ? data.event : null;
  return <Screen title="Find a squad" back={eventId ? `/events/${eventId}` : '/events'}>
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : <QueueSetup
      initialMode={mode === 'hangout' ? 'hangout' : 'events'}
      event={ev ? { id: ev.id, title: ev.title, startsAt: ev.startsAt, venue: ev.venueName, isPublic: ev.isPublicVenue } : null}
      landmarks={data.landmarks} shareDefault={data.shareDefault} />}
  </Screen>;
}
