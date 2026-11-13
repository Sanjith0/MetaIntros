import React, { useCallback, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { Avatar, Button, Loading, Screen, Section, c, font, t } from '../qu/ui';
import { Chip } from '../qu/QueueSetup';

interface Status {
  fillMode: 'simulated' | 'mixed' | 'live'; simFillMs: number; aiMode: 'mock' | 'cache' | 'live'; hasModelKey: boolean; model: string;
  clockOffsetMs: number; liveUsers: number; joinUrl: string; qr: string;
  buckets: Record<string, { size: number; queue: string; users: { id: string; name: string; avatarColor: string; real: boolean; waitedMs: number }[] }[]>;
  parties: { id: string; status: string; event: string | null; hangout?: boolean; area: string; size: number; real: number; accepted?: number; cohesion: number | null }[];
  aiLog: { task: string; source: string; ms: number; error?: string }[];
}
const SCRIPT = [
  'Events feed → open Indie Night', 'Find a squad to go with → size → Find my squad', 'Queue fills (~20s): k of N found',
  'Your squad is ready → How we matched you', 'Status card on the event and Events tab', 'Open squad chat: AI host welcome',
  'Talk cards (quick reply or squad info)', 'Find each other → I\'m here', 'Fast-forward: the event ends for everyone → chat archives',
  'Add squad as friends → Met through Queue Up', 'Join with Glance from the event page → back to the event',
];
const SOURCE: Record<string, string> = { live: 'Written by AI just now', cache: 'Saved AI response', mock: 'Test model', fallback: 'Template (AI unavailable)', template: 'Template', code: 'Checked by code', mixed: 'Partly AI, partly template' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtClock = (ms: number) => { const d = new Date(ms); return `${DAYS[d.getDay()]} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`; };
const fmtOffset = (ms: number) => { const h = Math.round(ms / 3_600_000); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`; };

/** The presenter's control panel (app/demo on the web app). */
export default function DemoScreen() {
  const { data: s, reload } = useData<Status>('/api/demo/status', 3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const act = useCallback(async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    const r = await postJSON<{ ok?: boolean; eventTitle?: string; squads?: number }>(url, body);
    setBusy(null);
    if (key === 'ff') setNote(r.data?.ok ? `Ended ${r.data.eventTitle} for ${r.data.squads} squad${r.data.squads === 1 ? '' : 's'}. Chats are read-only; sharing and adding friends are open.` : 'No active squad to end yet. Form a squad first.');
    reload();
  }, [reload]);
  return <Screen title="Demo" tabs testID="demo-page">
    {!s ? <Loading /> : <>
      <Section style={{ gap: 8 }}>
        <Button variant="primary" size="lg" icon="play" onPress={() => router.push('/events')} testID="demo-start">Start as Me</Button>
        <Button icon="rotate-ccw" disabled={!!busy} onPress={() => act('reset', '/api/demo/reset')} testID="demo-reset">{busy === 'reset' ? 'Resetting…' : 'Reset demo'}</Button>
        <Button icon="fast-forward" disabled={!!busy} onPress={() => act('ff', '/api/demo/fast-forward')} testID="demo-ff">Fast-forward to after the event</Button>
        <Button testID="demo-kick" icon="user-x" disabled={!!busy} onPress={() => act('kick', '/api/demo/kick-live')}>{`Kick live users (${s.liveUsers})`}</Button>
        {note ? <Text testID="ff-result" style={[t.meta, { backgroundColor: c.wash, padding: 10, borderRadius: 8, color: c.ink }]}>{note}</Text> : null}
        <Text testID="global-clock" style={t.meta}>Global clock: <Text style={{ color: c.ink, fontFamily: font.bold }}>{fmtClock(Date.now() + s.clockOffsetMs)}</Text>{s.clockOffsetMs > 60_000 ? ` (fast-forwarded ${fmtOffset(s.clockOffsetMs)})` : ' (real time)'} · same for every phone</Text>
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
      {s.aiLog.length ? <Section title="AI log" testID="ai-log">
        {s.aiLog.slice().reverse().map((l, i) => <Text key={i} style={[t.meta, { fontSize: 11 }]}>{l.task} · {SOURCE[l.source] ?? l.source} · {l.ms}ms{l.error ? ` · ${l.error}` : ''}</Text>)}
      </Section> : null}
      <Section title="Live queue" testID="demo-queue">
        {Object.keys(s.buckets).length === 0 ? <Text style={t.meta}>Nobody waiting.</Text> : Object.entries(s.buckets).map(([bucket, groups]) => <View key={bucket} style={{ backgroundColor: c.wash, borderRadius: 8, padding: 8, marginBottom: 8 }}>
          <Text style={[t.meta, { fontFamily: font.semibold }]}>{bucket}</Text>
          {groups.map(g => <View key={`${g.size}-${g.queue}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={[t.meta, { width: 110, color: c.ink }]}>size {g.size} · {g.queue}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 }}>{g.users.map(u => <View key={u.id} style={u.real ? { borderRadius: 14, borderWidth: 2, borderColor: c.accent } : undefined}><Avatar name={u.name} color={u.avatarColor} size={24} /></View>)}</View>
          </View>)}
        </View>)}
        {s.parties.length ? <View testID="demo-parties" style={{ gap: 4, marginTop: 4 }}>
          {s.parties.map(p => <Text key={p.id} style={[t.meta, { color: c.ink, backgroundColor: c.wash, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }]}>{p.status === 'completed' ? 'Done: ' : p.status === 'confirming' ? `Ready check (${p.accepted ?? 0}/${p.size} in): ` : 'Active: '}{p.size}-squad → {p.hangout ? 'new hangout: ' : ''}{p.event} · {p.area} · {p.real} real · cohesion {Math.round((p.cohesion ?? 0) * 100)}%</Text>)}
        </View> : null}
      </Section>
      <Section title="Script (5 min)">
        {SCRIPT.map((x, i) => <Text key={x} style={t.meta}>{i + 1}. {x}</Text>)}
      </Section>
    </>}
  </Screen>;
}
