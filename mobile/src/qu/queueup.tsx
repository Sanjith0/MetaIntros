import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getJSON, postJSON } from './api';
import { QueueSetup, type Landmark, type SetupEvent } from './QueueSetup';
import { AiLabel, Avatar, Button, DateLine, FacePile, Icon, IconCircle, Row, Section, Sheet, c, font, t, toast } from './ui';
import { fmtEventWhen } from './format';

/* ---------- RSVP (components/events/RsvpButtons.tsx) ---------- */

type Rsvp = 'interested' | 'going' | null;
function useRsvp(eventId: string, initial: string | null) {
  const [status, setStatus] = useState<Rsvp>(initial as Rsvp);
  useEffect(() => setStatus(initial as Rsvp), [initial]);
  const set = async (s: 'interested' | 'going') => {
    const next = status === s ? null : s;
    setStatus(next);
    await postJSON(`/api/events/${eventId}/rsvp`, { status: next });
  };
  return [status, set] as const;
}

/** Event page action row: equal-width Interested and Going, plus a square Invite. */
export function ActionRow({ eventId, initial }: { eventId: string; initial: string | null }) {
  const [status, set] = useRsvp(eventId, initial);
  return <View testID="rsvp" style={{ flexDirection: 'row', gap: 8 }}>
    <View style={{ flex: 1 }}><Button testID="rsvp-interested" variant={status === 'interested' ? 'on' : 'secondary'} icon="star" onPress={() => set('interested')}>Interested</Button></View>
    <View style={{ flex: 1 }}><Button testID="rsvp-going" variant={status === 'going' ? 'on' : 'secondary'} icon="check" onPress={() => set('going')}>Going</Button></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Invite" onPress={() => toast('Invites are off in this prototype.')}
      style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name="mail" size={16} /></Pressable>
  </View>;
}

/** Feed card footer: full-width Interested and a share button. */
export function CardActions({ eventId, initial }: { eventId: string; initial: string | null }) {
  const [status, set] = useRsvp(eventId, initial);
  const on = status === 'interested' || status === 'going';
  return <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
    <View style={{ flex: 1 }}><Button variant={on ? 'on' : 'secondary'} icon={status === 'going' ? 'check' : 'star'} onPress={() => set(status === 'going' ? 'going' : 'interested')}>{status === 'going' ? 'Going' : 'Interested'}</Button></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={() => toast('Sharing is off in this prototype.')}
      style={{ width: 44, height: 36, borderRadius: 6, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name="share-2" size={16} /></Pressable>
  </View>;
}

/* ---------- Go with a squad (components/queueup/QueueEntry.tsx) ---------- */

export interface PickableEvent extends SetupEvent { mine?: boolean }
type Step = { kind: 'modes' } | { kind: 'pick' } | { kind: 'setup'; mode: 'events' | 'hangout'; event: SetupEvent | null };

/**
 * "Go with a squad": one feed unit with one primary button. It opens a sheet: the queue modes, then setup.
 * On an event page (`event` set) the sheet opens straight at setup for that event.
 */
export function QueueEntry({ pulse, events = [], event, landmarks, shareDefault = false, friendsInLine = 0, again = false, also = false, autoOpen = false }: {
  pulse: string | null; events?: PickableEvent[]; event?: SetupEvent; landmarks: Landmark[]; shareDefault?: boolean; friendsInLine?: number; again?: boolean; also?: boolean; autoOpen?: boolean;
}) {
  const firstStep: Step = event ? { kind: 'setup', mode: 'events', event } : { kind: 'modes' };
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState<Step>(firstStep);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  const openAt = (s: Step) => { setStep(s); setOpen(true); };
  const close = () => { setOpen(false); setStep(firstStep); };
  const title = step.kind === 'modes' ? 'Find a squad' : step.kind === 'pick' ? 'Pick an event' : step.event ? step.event.title : step.mode === 'hangout' ? 'Plan a new hangout' : 'Any event this weekend';
  const sorted = [...events].sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)));
  const chevron = <Icon name="chevron-right" color={c.muted} />;
  return <View testID="queue-entry" style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconCircle name="users" on size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={t.title}>{again ? 'Up for another one?' : also ? 'Go with another squad' : event ? 'Going alone? Go with a squad' : 'Go with a squad'}</Text>
        {friendsInLine > 0 ? <Text testID="friends-in-line" style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>{friendsInLine === 1 ? '1 friend is' : `${friendsInLine} friends are`} in line for this</Text>
          : pulse ? <Text testID="queue-pulse" style={t.meta}>{pulse}</Text> : null}
      </View>
    </View>
    <View style={{ marginTop: 12, gap: 8 }}>
      <Button variant={again || also ? 'secondary' : 'primary'} testID={event ? 'queue-up-button' : 'queue-entry-open'} onPress={() => openAt(firstStep)}>
        {again || also ? 'Find another squad for an event' : event ? 'Find a squad to go with' : 'Find a squad for an event'}
      </Button>
      {!event ? <Button testID="queue-entry-hangout" icon="map" onPress={() => openAt({ kind: 'setup', mode: 'hangout', event: null })}>Plan a new hangout</Button> : null}
    </View>
    <Sheet open={open} onClose={close} title={title} testID="queue-sheet">
      {step.kind !== 'modes' && !event && !(step.kind === 'setup' && step.mode === 'hangout')
        ? <Pressable onPress={() => setStep(step.kind === 'setup' && step.event ? { kind: 'pick' } : { kind: 'modes' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 4 }}>
          <Icon name="chevron-left" size={16} color={c.link} /><Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>Back</Text>
        </Pressable> : null}
      {step.kind === 'modes' ? <View>
        <Row testID="queue-pick-event" icon="calendar" title="Pick an event" onPress={() => setStep({ kind: 'pick' })} trailing={chevron} />
        <Row testID="queue-anything" icon="sun" title="Any event this weekend" subtitle="We pick one you'll all like" onPress={() => setStep({ kind: 'setup', mode: 'events', event: null })} trailing={chevron} />
      </View> : step.kind === 'pick' ? <View testID="queue-event-list">
        {sorted.map(e => <Row key={e.id} testID={`queue-event-${e.id}`} onPress={() => setStep({ kind: 'setup', mode: 'events', event: e })} trailing={chevron}
          title={<View><DateLine start={e.startsAt} /><Text numberOfLines={1} style={t.bodyBold}>{e.title}</Text></View>}
          subtitle={`${e.mine ? "You're interested · " : ''}${e.venue}`} />)}
        {sorted.length === 0 ? <Text style={[t.meta, { textAlign: 'center', padding: 24 }]}>No public events coming up.</Text> : null}
      </View> : <QueueSetup variant="sheet" initialMode={step.mode} event={step.event} landmarks={landmarks} shareDefault={shareDefault} onJoined={close} />}
    </Sheet>
  </View>;
}

/* ---------- Your squads (components/queueup/MySquads.tsx) ---------- */

export interface ActiveSquad { partyId: string; chatId: string | null; name: string; eventId: string; eventTitle: string; startsAt: string; venueName: string; hangout: boolean; faces: { id: string; name: string; avatarColor: string }[] }
export function MySquads({ squads }: { squads: ActiveSquad[] }) {
  return <Section flush title={`Your squads · ${squads.length}`} testID="my-squads">
    {squads.map(s => <Row key={s.partyId} testID={`my-squad-${s.partyId}`} onPress={() => router.push((s.chatId ? `/chats/${s.chatId}` : `/squad/${s.partyId}`) as never)}
      leading={<FacePile people={s.faces.slice(0, 2)} size={40} max={2} />} title={s.name}
      subtitle={`${fmtEventWhen(s.startsAt)} · ${s.hangout ? 'New hangout' : s.venueName}`} trailing={<Icon name="chevron-right" color={c.muted} />} />)}
  </Section>;
}

/* ---------- Friends' queues (components/queueup/FriendQueues.tsx) ---------- */

export interface FriendQueue {
  entryId: string; friend: { id: string; name: string; avatarColor: string }; mode: 'events' | 'hangout'; event: { id: string; title: string; startsAt: string } | null;
  area: string; state: 'waiting' | 'in_squad'; since: string; targetSize: number; label: string; canJoin: boolean; cantJoinReason?: string;
  found?: number; together: number; togetherFriends: string[]; room: number; canJoinTogether: boolean;
}
const first = (n: string) => n.split(' ')[0];
const minutes = (iso: string, nowMs: number) => Math.max(1, Math.round((nowMs - new Date(iso).getTime()) / 60_000));
const WHY_SOURCE: Record<string, string> = { live: 'Written by AI just now', cache: 'Saved AI response', mock: 'Test model', fallback: 'Template (AI unavailable)' };
const CANT: Record<string, string> = {
  in_squad: 'Their squad is already set, so this queue is closed.', women_only: 'This is a women-only queue.',
  age_band: "Squads are matched within an age range, so you can't join this one.", blocked: "You can't join this queue.", full: 'Their squad has no room left for friends.',
};

/** The friends who chose to share which queue they're in: a rail on Events, rows on an event page. Both open the same sheet. */
export function FriendQueues({ queues, variant = 'rail', nowMs, eventTitle }: { queues: FriendQueue[]; variant?: 'rail' | 'list'; nowMs: number; eventTitle?: string }) {
  const [open, setOpen] = useState<FriendQueue | null>(null);
  if (!queues.length) return null;
  return <>
    {variant === 'rail' ? <Section flush title="Friends queuing" testID="friend-queues">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingVertical: 4 }}>
        {queues.map(q => <Pressable key={q.entryId} testID="friend-queue" onPress={() => setOpen(q)} style={{ width: 80, alignItems: 'center' }}>
          <View style={{ borderRadius: 32, padding: 2, borderWidth: 2, borderColor: q.state === 'waiting' ? c.accent : c.divider }}><Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} /></View>
          <Text numberOfLines={1} style={[t.meta, { color: c.ink, fontFamily: font.semibold, marginTop: 4 }]}>{first(q.friend.name)}</Text>
          <Text numberOfLines={1} style={[t.meta, { fontSize: 12 }]}>{q.mode === 'hangout' ? 'New hangout' : q.event?.title ?? 'Any event'}</Text>
        </Pressable>)}
      </ScrollView>
    </Section> : <Section flush title={eventTitle ? 'Friends in this queue' : 'Friends queuing'} testID="friend-queues-event">
      {queues.map(q => <Row key={q.entryId} testID="friend-queue" onPress={() => setOpen(q)} leading={<Avatar name={q.friend.name} color={q.friend.avatarColor} size={44} />}
        title={q.friend.name} subtitle={`${q.state === 'waiting' ? `In line for ${minutes(q.since, nowMs)} min` : 'In a squad'} · near ${q.area}`} trailing={<Icon name="chevron-right" color={c.muted} />} />)}
    </Section>}
    <FriendQueueSheet q={open} onClose={() => setOpen(null)} nowMs={nowMs} />
  </>;
}

function FriendQueueSheet({ q, onClose, nowMs }: { q: FriendQueue | null; onClose: () => void; nowMs: number }) {
  const [why, setWhy] = useState<{ line: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setWhy(null); setError(null);
    if (!q) return;
    let live = true;
    getJSON<{ ok?: boolean; line: string; source: string }>(`/api/friends/queues/${q.entryId}/why`).then(j => { if (live && j?.ok) setWhy({ line: j.line, source: j.source }); }).catch(() => {});
    return () => { live = false; };
  }, [q]);
  const join = async (separate = false) => {
    if (!q) return;
    setBusy(true); setError(null);
    const r = await postJSON<{ ok?: boolean; error?: string }>(`/api/friends/queues/${q.entryId}/join`, { separate });
    if (r.data?.ok) { onClose(); router.push('/queue'); return; }
    setBusy(false);
    setError(r.data?.error === 'age' ? 'Queue Up is for people 18 and over.' : r.data?.error === 'not_visible' ? `${first(q.friend.name)} isn't sharing this queue anymore.` : "Couldn't join the queue. Try again.");
  };
  const progress = q && q.state === 'waiting'
    ? `${q.found ? `${Math.min(q.found, q.targetSize)} of ${q.targetSize} found` : 'Looking for matches'}${q.together > 0
      ? ` · with ${q.togetherFriends.length ? q.togetherFriends.join(', ') : ''}${q.togetherFriends.length && q.together > q.togetherFriends.length ? ' and ' : ''}${q.together > q.togetherFriends.length ? `${q.together - q.togetherFriends.length} other${q.together - q.togetherFriends.length > 1 ? 's' : ''}` : ''}` : ''}` : null;
  return <Sheet open={!!q} onClose={onClose} title={q ? `${first(q.friend.name)} is ${q.state === 'waiting' ? 'queuing' : 'in a squad'}` : ''} testID="friend-queue-sheet">
    {q ? <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={q.friend.name} color={q.friend.avatarColor} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="friend-queue-label" style={t.bodyBold}>{q.friend.name}</Text>
          <Text style={t.body}>{q.label}</Text>
          <Text style={t.meta}>Near {q.area}{q.state === 'waiting' ? ` · ${minutes(q.since, nowMs)} min in line` : ''} · Squads of {q.targetSize}</Text>
          {progress ? <Text testID="friend-queue-progress" style={t.meta}>{progress}</Text> : null}
        </View>
      </View>
      {q.event ? <Pressable testID="friend-queue-event" onPress={() => { onClose(); router.push(`/events/${q.event!.id}`); }} style={{ backgroundColor: c.wash, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        <DateLine start={q.event.startsAt} /><Text numberOfLines={1} style={t.bodyBold}>{q.event.title}</Text>
      </Pressable> : null}
      {why ? <View testID="friend-queue-why" style={{ gap: 2 }}><Text style={t.body}>{why.line}</Text><AiLabel testID="friend-queue-why-source">{WHY_SOURCE[why.source] ?? 'Written by AI'}</AiLabel></View> : null}
      <View style={{ gap: 8 }}>
        {q.canJoinTogether ? <Button testID="join-friend-squad" variant="primary" size="lg" disabled={busy} onPress={() => join(false)}>{busy ? 'Joining…' : `Join ${first(q.friend.name)}`}</Button>
          : q.canJoin ? <Button testID="queue-up-too" variant="primary" size="lg" disabled={busy} onPress={() => join(true)}>{busy ? 'Joining…' : 'Queue up too'}</Button>
          : <Text testID="friend-queue-closed" style={[t.meta, { backgroundColor: c.wash, borderRadius: 8, padding: 12 }]}>{CANT[q.cantJoinReason ?? ''] ?? "You can't join this queue."}</Text>}
        {q.canJoinTogether && q.canJoin ? <Button testID="queue-up-too" disabled={busy} onPress={() => join(true)}>Queue separately</Button> : null}
        {q.event ? <Button onPress={() => { onClose(); router.push(`/events/${q.event!.id}`); }}>View event</Button> : null}
      </View>
      {q.canJoinTogether ? <Text testID="join-together-note" style={t.meta}>You&apos;ll queue together with {first(q.friend.name)} and land in the same squad. Queue Up fills the other spots.</Text>
        : q.canJoin ? <Text style={t.meta}>You&apos;ll be in the same queue, near {q.area}. You might end up in the same squad, but it isn&apos;t guaranteed.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[t.meta, { color: c.badge, fontFamily: font.semibold }]}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}><Icon name="eye-off" size={14} color={c.muted} /><Text style={[t.meta, { flex: 1 }]}>{first(q.friend.name)} chose to share this with friends. You only see the area, never who else is in line.</Text></View>
    </View> : null}
  </Sheet>;
}
