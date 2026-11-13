import React, { useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { postJSON } from './api';
import { Button, DateLine, Icon, IconCircle, Row, c, font, t } from './ui';

export interface SetupEvent { id: string; title: string; startsAt: string; venue: string; isPublic: boolean }
export interface Landmark { id: string; name: string; city: string }
export const SIZES = [4, 5, 6] as const;

const ERRORS: Record<string, string> = {
  private_event: 'Queue Up only works for events at public venues.',
  age: 'Queue Up is for people 18 and over.',
  sensitive_tonight: "Keep it to plans and vibe: your note can't mention health, religion, politics or sexuality.",
};

function getPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : null;
    if (Platform.OS !== 'web' || !nav?.geolocation) return reject(new Error('unavailable'));
    nav.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { timeout: timeoutMs, maximumAge: 60_000 });
  });
}

export function Chip({ on, children, onPress, icon, testID }: { on: boolean; children: string; onPress: () => void; icon?: React.ComponentProps<typeof Icon>['name']; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress}
    style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: on ? c.on : c.control }}>
    {icon ? <Icon name={icon} size={16} color={on ? c.link : c.ink} /> : null}
    <Text style={{ fontFamily: font.semibold, fontSize: 15, color: on ? c.link : c.ink }}>{children}</Text>
  </Pressable>;
}

/** Queue setup: one decision (size), one button. Mirrors components/queue/QueueSetup.tsx on the web app. */
export function QueueSetup({ event, landmarks, initialMode = 'events', shareDefault = false }: { event: SetupEvent | null; landmarks: Landmark[]; initialMode?: 'events' | 'hangout'; shareDefault?: boolean }) {
  const [mode, setMode] = useState<'events' | 'hangout'>(event ? 'events' : initialMode);
  const [size, setSize] = useState(5);
  const [loc, setLoc] = useState<{ kind: 'idle' } | { kind: 'locating' } | { kind: 'manual'; reason: string }>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(shareDefault);
  const [tonight, setTonight] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  const join = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    const r = await postJSON<{ ok?: boolean; error?: string }>('/api/queue/join', { mode, eventId: mode === 'events' ? event?.id ?? null : null, targetSize: size, visibleToFriends: share, tonight: tonight.trim() || null, ...body });
    if (r.data?.ok) { router.push('/queue'); return; }
    setBusy(false);
    if (r.data?.error === 'too_far') setLoc({ kind: 'manual', reason: "You're far from Queue Up areas. Pick one to find your squad" });
    else setError(ERRORS[r.data?.error ?? ''] ?? "Couldn't join the queue. Try again.");
  };
  const findSquad = async () => {
    setLoc({ kind: 'locating' });
    try { const p = await getPosition(); await join({ ...p, locationSource: 'gps' }); }
    catch { setLoc({ kind: 'manual', reason: 'Location is off. Pick an area to find your squad' }); }
  };
  if (event && !event.isPublic) return <View style={{ backgroundColor: c.surface, padding: 16 }}><Text style={t.meta}>Queue Up only works for events at public venues.</Text></View>;
  const title = event ? event.title : mode === 'hangout' ? 'Plan a new hangout' : 'Any event this weekend';

  return <View testID="queue-setup" style={{ backgroundColor: c.surface, paddingBottom: 16 }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {event ? <DateLine start={event.startsAt} /> : null}
      <Text style={t.headline}>{title}</Text>
      {event ? <Text style={t.meta}>{event.venue}</Text> : null}
    </View>
    {!event && <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 }}>
      <Chip on={mode === 'events'} icon="calendar" onPress={() => setMode('events')} testID="queue-mode-events">Any event</Chip>
      <Chip on={mode === 'hangout'} icon="map" onPress={() => setMode('hangout')} testID="queue-mode-hangout">New hangout</Chip>
    </View>}
    <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 8 }}>
      <Text style={t.bodyBold}>Squad size, including you</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SIZES.map(n => <Chip key={n} on={size === n} onPress={() => setSize(n)} testID={`size-${n}`}>{`${n} people`}</Chip>)}
      </View>
    </View>
    <View style={{ marginTop: 12 }}>
      {loc.kind !== 'manual'
        ? <Row icon="map-pin" title="Starting area" subtitle="Location used once, never stored or shown" testID="choose-area"
          onPress={() => setLoc({ kind: 'manual', reason: 'Pick an area to find your squad' })} trailing={<Icon name="chevron-right" color={c.muted} />} />
        : <View testID="area-picker">
          <Text style={[t.bodyBold, { paddingHorizontal: 16, paddingTop: 8 }]}>{loc.reason}</Text>
          {landmarks.map(l => <Row key={l.id} icon="map-pin" title={l.name} subtitle={l.city} testID={`area-${l.id}`}
            onPress={busy ? undefined : () => join({ landmarkId: l.id, locationSource: 'manual' })} />)}
        </View>}
      {noteOpen ? <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
        <Text style={t.bodyBold}>What do you want tonight?</Text>
        <TextInput value={tonight} onChangeText={v => setTonight(v.slice(0, 200))} multiline autoFocus
          placeholder="e.g. first night out since moving, somewhere I can actually talk" placeholderTextColor={c.muted}
          style={[t.body, { backgroundColor: c.wash, borderRadius: 6, padding: 12, minHeight: 60 }]} />
        <Text style={t.meta}>Only your Companion reads this.</Text>
      </View> : <Row icon="star" title="Add a note for your Companion" subtitle="Your AI Companion talks to others for you" onPress={() => setNoteOpen(true)} trailing={<Icon name="chevron-right" color={c.muted} />} />}
      <Row icon="eye" title="Let friends see you're queuing" subtitle="They see the event and your area" trailing={<Switch value={share} onValueChange={setShare} />} />
    </View>
    <Text style={[t.meta, { marginHorizontal: 16, marginTop: 8 }]}>18+, public places only, never anyone you&apos;ve blocked</Text>
    {error ? <Text accessibilityRole="alert" style={[t.meta, { marginHorizontal: 16, marginTop: 12, color: c.badge, fontFamily: font.semibold }]}>{error}</Text> : null}
    {loc.kind !== 'manual' && <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <Button variant="primary" size="lg" disabled={busy || loc.kind === 'locating'} onPress={findSquad} testID="find-squad">
        {loc.kind === 'locating' ? 'Finding your area…' : 'Find my squad'}
      </Button>
    </View>}
  </View>;
}
