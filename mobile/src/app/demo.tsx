import React, { useCallback, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { Button, Loading, Screen, Section, c, font, t } from '../qu/ui';
import { Chip } from '../qu/QueueSetup';

interface Status {
  fillMode: 'simulated' | 'mixed' | 'live'; simFillMs: number; aiMode: 'mock' | 'cache' | 'live'; hasModelKey: boolean; model: string;
  clockOffsetMs: number; liveUsers: number; joinUrl: string; qr: string;
  parties: { id: string; status: string; event: string | null; area: string; size: number; real: number }[];
}

/** The presenter's control panel (app/demo on the web app). */
export default function DemoScreen() {
  const { data: s, reload } = useData<Status>('/api/demo/status', 3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const act = useCallback(async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    const r = await postJSON<{ message?: string; note?: string }>(url, body);
    setBusy(null);
    if (key === 'ff') setNote(r.data?.message ?? r.data?.note ?? (r.ok ? 'Fast-forwarded.' : 'Fast-forward failed.'));
    reload();
  }, [reload]);
  return <Screen title="Demo" tabs testID="demo-page">
    {!s ? <Loading /> : <>
      <Section style={{ gap: 8 }}>
        <Button variant="primary" size="lg" icon="play" onPress={() => router.push('/events')} testID="demo-start">Start as Me</Button>
        <Button icon="rotate-ccw" disabled={!!busy} onPress={() => act('reset', '/api/demo/reset')} testID="demo-reset">{busy === 'reset' ? 'Resetting…' : 'Reset demo'}</Button>
        <Button icon="fast-forward" disabled={!!busy} onPress={() => act('ff', '/api/demo/fast-forward')} testID="demo-ff">Fast-forward to after the event</Button>
        <Button icon="user-x" disabled={!!busy} onPress={() => act('kick', '/api/demo/kick-live')}>{`Kick live users (${s.liveUsers})`}</Button>
        {note ? <Text style={[t.meta, { backgroundColor: c.wash, padding: 10, borderRadius: 8 }]}>{note}</Text> : null}
        <Text style={t.meta}>Global clock: {new Date(Date.now() + s.clockOffsetMs).toLocaleString()} {s.clockOffsetMs > 60_000 ? '(fast-forwarded)' : '(real time)'}</Text>
      </Section>
      <Section title="Judges: scan to join live" style={{ alignItems: 'center' }}>
        {Platform.OS === 'web' && s.qr ? <Image accessibilityLabel="QR code to join" source={{ uri: `data:image/svg+xml;base64,${btoa(s.qr)}` }} style={{ width: 220, height: 220 }} /> : null}
        <Text selectable style={[t.meta, { marginTop: 6 }]}>{s.joinUrl}</Text>
      </Section>
      <Section title="Who fills the queue?">
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['simulated', 'mixed', 'live'] as const).map(m => <Chip key={m} on={s.fillMode === m} onPress={() => act('mode', '/api/demo/settings', { fillMode: m })}>{m === 'live' ? 'Live only' : m[0].toUpperCase() + m.slice(1)}</Chip>)}
        </View>
        <Text style={[t.meta, { marginTop: 8 }]}>{s.fillMode === 'live' ? 'Only real people. Everyone must pick the same squad size.' : s.fillMode === 'mixed' ? 'Real people first; simulated people fill empty spots after about 12s.' : 'Simulated people fill the queue.'}</Text>
        <Text style={[t.bodyBold, { marginTop: 12, marginBottom: 6 }]}>Queue fill time</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[6000, 12000, 18000, 25000].map(v => <Chip key={v} on={s.simFillMs === v} onPress={() => act('fill', '/api/demo/settings', { simFillMs: v })}>{`${v / 1000}s`}</Chip>)}
        </View>
      </Section>
      <Section title={`AI (Muse · ${s.model})`}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip on={s.aiMode !== 'live'} onPress={() => act('ai', '/api/demo/settings', { aiMode: 'cache' })}>Cached</Chip>
          {s.hasModelKey ? <Chip on={s.aiMode === 'live'} onPress={() => act('ai', '/api/demo/settings', { aiMode: 'live' })}>Live Muse</Chip> : null}
        </View>
        {!s.hasModelKey ? <Text style={[t.meta, { marginTop: 6 }]}>No Muse key on this server, so it runs from the cache.</Text> : null}
      </Section>
      <Section title="Squads">
        {s.parties.length === 0 ? <Text style={t.meta}>No squads yet.</Text> : s.parties.map(p => <Text key={p.id} style={[t.meta, { color: c.ink, fontFamily: font.body, paddingVertical: 2 }]}>{p.event ?? 'Hangout'} · {p.area} · {p.size} people ({p.real} real) · {p.status}</Text>)}
      </Section>
    </>}
  </Screen>;
}
