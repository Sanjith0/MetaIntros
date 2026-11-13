import React, { useCallback, useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { postJSON } from './api';
import { Button, DateLine, Icon, OpenedHeader, Row, c, font, t } from './ui';
import { QueueTogether, type TogetherRole } from './QueueTogether';

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

export function Chip({ on, children, onPress, icon, testID, disabled }: { on: boolean; children: string; onPress: () => void; icon?: React.ComponentProps<typeof Icon>['name']; testID?: string; disabled?: boolean }) {
  return <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={onPress}
    style={{ opacity: disabled ? 0.4 : 1, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: on ? c.on : c.control }}>
    {icon ? <Icon name={icon} size={16} color={on ? c.link : c.ink} /> : null}
    <Text style={{ fontFamily: font.semibold, fontSize: 15, color: on ? c.link : c.ink }}>{children}</Text>
  </Pressable>;
}

/** Queue setup: one decision (size), one button. Mirrors components/queue/QueueSetup.tsx on the web app. */
export function QueueSetup({ event, landmarks, initialMode = 'events', shareDefault = false, variant = 'page', onJoined }: { event: SetupEvent | null; landmarks: Landmark[]; initialMode?: 'events' | 'hangout'; shareDefault?: boolean; variant?: 'page' | 'sheet'; /** close the sheet this sits in before moving on */ onJoined?: () => void }) {
  const [mode, setMode] = useState<'events' | 'hangout'>(event ? 'events' : initialMode);
  const [size, setSize] = useState(5);
  const [loc, setLoc] = useState<{ kind: 'idle' } | { kind: 'locating' } | { kind: 'manual'; reason: string }>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(shareDefault);
  const [tonight, setTonight] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [together, setTogether] = useState<TogetherRole>({ role: 'none', joined: 1 });
  const onRole = useCallback((r: TogetherRole) => {
    setTogether(r);
    // the squad needs room for the whole group plus at least one new person
    if (r.role === 'host') setSize(n => (n - 1 < r.joined ? (SIZES.find(x => x - 1 >= r.joined) ?? n) : n));
  }, []);
  const member = together.role === 'member';

  const join = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    const r = await postJSON<{ ok?: boolean; error?: string }>('/api/queue/join', { mode, eventId: mode === 'events' ? event?.id ?? null : null, targetSize: size, visibleToFriends: share, tonight: tonight.trim() || null, ...body });
    if (r.data?.ok) { onJoined?.(); router.push('/queue'); return; }
    setBusy(false);
    if (r.data?.error === 'too_far') setLoc({ kind: 'manual', reason: "You're far from Queue Up areas. Pick one to find your squad" });
    else setError(ERRORS[r.data?.error ?? ''] ?? "Couldn't join the queue. Try again.");
  };
  const findSquad = async () => {
    setLoc({ kind: 'locating' });
    try { const p = await getPosition(); await join({ ...p, locationSource: 'gps' }); }
    catch { setLoc({ kind: 'manual', reason: 'Location is off. Pick an area to find your squad' }); }
  };
  if (event && !event.isPublic) return <View testID="queue-setup" style={{ backgroundColor: c.surface, padding: 16, flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="lock" size={16} color={c.muted} /><Text style={t.meta}>Queue Up only works for events at public venues.</Text></View>;
  const title = event ? event.title : mode === 'hangout' ? 'Plan a new hangout' : 'Any event this weekend';
  const chevron = <Icon name="chevron-right" color={c.muted} />;

  return <View testID="queue-setup" style={{ backgroundColor: c.surface, paddingBottom: variant === 'page' ? 16 : 4 }}>
    {variant === 'page' ? <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {event ? <DateLine start={event.startsAt} /> : null}
      <Text testID="queue-title" style={t.headline}>{title}</Text>
      {event ? <Text style={t.meta}>{event.venue}</Text> : null}
    </View> : null}
    {!event && variant === 'page' && <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 }}>
      <Chip on={mode === 'events'} icon="calendar" onPress={() => setMode('events')} testID="queue-mode-events">Any event</Chip>
      <Chip on={mode === 'hangout'} icon="map" onPress={() => setMode('hangout')} testID="queue-mode-hangout">New hangout</Chip>
    </View>}
    <View style={{ paddingHorizontal: 16, marginTop: variant === 'page' ? 16 : 4, gap: 8 }}>
      <Text style={t.bodyBold}>Squad size, including you</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SIZES.map(n => <Chip key={n} on={size === n} disabled={together.role === 'host' && n - 1 < together.joined} onPress={() => setSize(n)} testID={`size-${n}`}>{`${n} people`}</Chip>)}
      </View>
    </View>
    <View style={{ marginTop: 12 }}>
      <QueueTogether onRole={onRole} onQueued={onJoined} />
      {member ? null : loc.kind !== 'manual'
        ? <Row icon="map-pin" title="Starting area" subtitle="Location used once, never stored or shown" testID="choose-area"
          onPress={() => setLoc({ kind: 'manual', reason: 'Pick an area to find your squad' })} trailing={chevron} />
        : <View testID="area-picker">
          <OpenedHeader title={loc.reason} testID="area-picker-close" onClose={() => setLoc({ kind: 'idle' })} />
          {landmarks.map(l => <Row key={l.id} icon="map-pin" title={l.name} subtitle={l.city} testID={`area-${l.id}`}
            onPress={busy ? undefined : () => join({ landmarkId: l.id, locationSource: 'manual' })} />)}
        </View>}
      {noteOpen ? <View style={{ paddingBottom: 8, gap: 4 }}>
        <OpenedHeader title="What do you want tonight?" testID="companion-note-close" onClose={() => setNoteOpen(false)} />
        <View style={{ paddingHorizontal: 16, gap: 4 }}>
        <TextInput testID="tonight" value={tonight} onChangeText={v => setTonight(v.slice(0, 200))} multiline autoFocus
          placeholder="e.g. first night out since moving, somewhere I can actually talk" placeholderTextColor={c.muted}
          style={[t.body, { backgroundColor: c.wash, borderRadius: 6, padding: 12, minHeight: 60 }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="lock" size={12} color={c.muted} /><Text style={t.meta}>Only your Companion reads this. </Text>
          <Pressable testID="review-brief" onPress={() => { onJoined?.(); router.push('/profile'); }}><Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>What it shares</Text></Pressable>
        </View>
        </View>
      </View> : <Row testID="companion-note" icon="star" title={tonight.trim() ? 'Your note for your Companion' : 'Add a note for your Companion'} subtitle={tonight.trim() ? tonight.trim() : 'Your AI Companion talks to others for you'} onPress={() => setNoteOpen(true)} trailing={chevron} />}
      <Row testID="share-with-friends" icon="eye" title="Let friends see you're queuing" subtitle="They see the event and your area" trailing={<Switch testID="share-with-friends-toggle" value={share} onValueChange={setShare} />} />
    </View>
    <View testID="safety-line" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 8 }}>
      <Icon name="shield" size={12} color={c.muted} /><Text style={t.meta}>18+, public places only, never anyone you&apos;ve blocked</Text>
    </View>
    {error ? <Text testID="queue-error" accessibilityRole="alert" style={[t.meta, { marginHorizontal: 16, marginTop: 12, color: c.badge, fontFamily: font.semibold }]}>{error}</Text> : null}
    {loc.kind !== 'manual' && !member && <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <Button variant="primary" size="lg" disabled={busy || loc.kind === 'locating'} onPress={findSquad} testID="find-squad">
        {loc.kind === 'locating' ? 'Finding your area…' : together.role === 'host' && together.joined > 1 ? `Find a squad for ${together.joined} of you` : 'Find my squad'}
      </Button>
    </View>}
  </View>;
}
