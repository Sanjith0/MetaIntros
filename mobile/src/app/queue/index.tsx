import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getJSON, postJSON } from '../../qu/api';
import { useData } from '../../qu/hooks';
import { Avatar, Button, Cover, DateLine, Icon, IconCircle, Loading, Progress, Row, Screen, Section, c, font, t } from '../../qu/ui';
import { first, fmtDuration } from '../../qu/format';
import { CompanionFeed } from '../../qu/Companion';
import { SearchMap, SquadDecision, type SearchAreaView } from '../../qu/decision';

interface Status {
  state: 'idle' | 'waiting' | 'matched'; targetSize?: number; mode?: 'events' | 'hangout'; eventId?: string | null; eventTitle?: string | null;
  bucketName?: string; bucketId?: string; problem?: 'no_events' | 'event_started' | 'no_fit' | 'no_squad'; stage?: string;
  waitedMs?: number; found?: number; foundUsers?: { id: string; name: string; avatarColor: string }[];
  together?: { id: string; name: string }[]; partyId?: string | null; searchArea?: SearchAreaView | null;
}
interface Member { acceptedAt: string | null; shared?: string[]; user: { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean } }
interface Party {
  id: string; status: string; acceptBy: string | null; members: Member[];
  event: { id: string; title: string; startsAt: string; venueName: string; kind?: string; description?: string; coverColor?: string } | null;
  chat: { id: string } | null;
}

const STAGE_LABEL: Record<string, string> = {
  briefing: 'Companions are reading profiles', circles: 'Grouping people who might click', mingling: 'Your Companion is meeting everyone',
  checkin: 'Your Companion is checking its picks with you', deep: 'Going deeper with a few people', deliberating: 'Companions are proposing squads',
  forming: 'Forming your squad', group: "Your squad's Companions are talking it over", signoff: "Waiting for everyone's yes",
};
const PROBLEM_TEXT: Record<string, string> = {
  no_events: 'There are no upcoming events left this weekend to sort your squad into.',
  event_started: "This event has already started, so we can't form a squad for it.",
  no_fit: "We found people, but no event works for everyone's free time and tastes yet. We'll keep trying.",
  no_squad: "Your Companion talked with everyone here, but the Companions didn't settle on a squad. You'll be matched as soon as someone new joins the queue.",
};
const isSample = (u: Member['user'], meId: string) => Boolean(u.isSimulated && !u.isLive && u.id !== meId);

export default function QueueScreen() {
  const me = useData<{ me: { id: string } }>('/api/m/me');
  const meId = me.data?.me.id ?? '';
  const [status, setStatus] = useState<Status | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<'requeued' | 'dropped' | null>(null);
  const base = useRef<{ at: number; waited: number } | null>(null);
  const partyRef = useRef<Party | null>(null);
  partyRef.current = party;
  const live = !party || party.status === 'confirming';

  const refresh = useCallback(async () => {
    const s = await getJSON<Status>('/api/queue/status').catch(() => null);
    if (!s) return;
    const had = partyRef.current;
    if (had?.status === 'confirming' && !(s.state === 'matched' && s.partyId === had.id)) {
      setParty(null); base.current = null; setNotice(s.state === 'waiting' ? 'requeued' : 'dropped');
    }
    setStatus(s);
    if (s.state === 'waiting' && s.waitedMs != null && !base.current) base.current = { at: Date.now(), waited: s.waitedMs };
    if (s.state === 'matched' && s.partyId) {
      const p = await getJSON<Party>(`/api/party/${s.partyId}`).catch(() => null);
      if (p && p.status !== 'cancelled' && p.status !== 'forming') setParty(p);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    const timer = setInterval(() => { if (live) refresh(); }, 1200);
    return () => clearInterval(timer);
  }, [refresh, live]));
  useEffect(() => {
    const timer = setInterval(() => base.current && setElapsed(base.current.waited + Date.now() - base.current.at), 250);
    return () => clearInterval(timer);
  }, []);

  if (party?.status === 'confirming') return <ReadyCheck party={party} meId={meId} onChange={refresh} />;
  if (party) return <SquadFound party={party} meId={meId} />;
  if (!status) return <Screen title="Finding your squad" back="/events"><Loading /></Screen>;
  if (status.state === 'idle') return <Screen title="Queue Up" back="/events" testID="queue-idle">
    <Section style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
      {notice === 'dropped' ? <Text style={[t.body, { backgroundColor: c.wash, padding: 12, borderRadius: 8 }]}>That squad didn&apos;t come together, so you&apos;re out of the queue. Find a squad again whenever you like.</Text> : null}
      <Text style={t.body}>You&apos;re not in a queue.</Text>
      <Button block={false} onPress={() => router.replace('/events')}>Browse events</Button>
    </Section>
  </Screen>;

  const n = status.targetSize ?? 5;
  const found = Math.min(status.found ?? 1, n);
  const users = status.foundUsers ?? [];
  const widening = status.problem === 'no_squad' ? 'Waiting for someone new to join'
    : status.stage && STAGE_LABEL[status.stage] ? STAGE_LABEL[status.stage]
    : elapsed > 16_000 ? 'Looking in nearby areas too' : elapsed > 8_000 ? 'Widening the search a little' : "Looking for people you'd get along with";
  const kind = status.mode === 'hangout' ? 'New hangout' : status.eventId ? status.eventTitle ?? 'This event' : 'Any event this weekend';
  const hangout = status.mode === 'hangout';
  const switchToHangout = async () => {
    await postJSON('/api/queue/join', { mode: 'hangout', eventId: null, targetSize: status.targetSize, landmarkId: status.bucketId, locationSource: 'manual' });
    refresh();
  };
  return <Screen title="Finding your squad" back="/events" testID="queue-screen">
    <Section>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconCircle name={hangout ? 'map' : 'calendar'} on />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={t.bodyBold}>{kind}</Text>
          <Text style={t.meta}>Near {status.bucketName} · squad of {n}</Text>
          {status.together?.length ? <Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>Together with {status.together.map(x => first(x.name)).join(', ')}</Text> : null}
        </View>
      </View>
      {notice === 'requeued' ? <Text style={[t.body, { backgroundColor: c.wash, padding: 12, borderRadius: 8, marginTop: 12 }]}>That squad didn&apos;t come together, so we&apos;re finding you another. You kept your place in line.</Text> : null}
      <Text testID="queue-timer" style={[t.timer, { textAlign: 'center', marginTop: 16 }]}>{fmtDuration(elapsed)}</Text>
      <Text testID="room-stage" style={[t.meta, { textAlign: 'center' }]}>{widening}</Text>
      {status.searchArea ? <SearchMap area={status.searchArea} me={users[0]} /> : null}
      <Text testID="players-found" style={[t.bodyBold, { marginTop: 20, marginBottom: 8 }]}>{found} of {n} found</Text>
      <Progress value={found} max={n} />
      <View testID="player-slots" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        {Array.from({ length: n }).map((_, i) => {
          const u = users[i];
          return <View key={u?.id ?? `empty-${i}`} style={{ width: 52, alignItems: 'center', gap: 4 }}>
            {u ? <Avatar name={i === 0 ? u.name : 'Someone nearby'} color={u.avatarColor} size={48} blurred={i !== 0} />
              : <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: c.divider }} />}
            <Text style={{ fontSize: 11, color: c.muted, fontFamily: font.body }}>{u ? (i === 0 ? 'You' : 'Found') : ''}</Text>
          </View>;
        })}
      </View>
      <Text style={[t.meta, { marginTop: 12 }]}>You&apos;ll see who they are once your squad is ready.</Text>
      {status.problem ? <View style={{ backgroundColor: c.wash, borderRadius: 8, padding: 12, marginTop: 12, gap: 8 }}>
        <Text style={t.body}>{hangout && status.problem === 'no_fit' ? "We found people, but no public spot near all of you works for everyone's free time yet. We'll keep trying." : PROBLEM_TEXT[status.problem]}</Text>
        {!hangout && status.problem !== 'no_squad' ? <Button icon="map" onPress={switchToHangout}>Plan a new hangout instead</Button> : null}
      </View> : null}
    </Section>
    <CompanionFeed meId={users[0]?.id ?? meId} />
    <Section flush title="While you wait">
      <Row icon="eye-off" title="Nobody sees you yet" subtitle="Your squad sees your first name once it's ready." />
      <Row icon="shield" title="Public places only" subtitle="Squads meet at the event's front entrance." />
      <Row icon="log-out" title="Leave any time" subtitle="Nobody is told why." />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Button testID="leave-queue" onPress={async () => { await postJSON('/api/queue/leave'); router.replace('/events'); }}>Leave queue</Button>
      </View>
    </Section>
  </Screen>;
}

function ReadyCheck({ party, meId, onChange }: { party: Party; meId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const end = party.acceptBy ? new Date(party.acceptBy).getTime() : Date.now();
  const [left, setLeft] = useState(() => end - Date.now());
  useEffect(() => { const timer = setInterval(() => setLeft(end - Date.now()), 500); return () => clearInterval(timer); }, [end]);
  const me = party.members.find(m => m.user.id === meId);
  const inCount = party.members.filter(m => m.acceptedAt).length;
  const hangout = party.event?.kind === 'hangout';
  const answer = async (what: 'accept' | 'decline') => {
    setBusy(true);
    await postJSON(`/api/party/${party.id}/${what}`);
    if (what === 'decline') { router.replace('/events'); return; }
    onChange(); setBusy(false);
  };
  return <Screen title="Your squad" back="/events" testID="ready-check">
    <Section>
      <Text style={t.page}>We found your squad</Text>
      <Text style={[t.body, { color: c.muted, marginTop: 4 }]}>{party.event ? (hangout ? 'A new hangout, just for you. ' : `Going to ${party.event.title}. `) : ''}Say you&apos;re in to see who they are and open the chat.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text testID="ready-count" style={t.meta}>{inCount} of {party.members.length} in</Text>
        <Text style={t.meta}>{fmtDuration(Math.max(0, left))} left</Text>
      </View>
      {me?.acceptedAt ? <Text testID="waiting-on" style={[t.bodyBold, { textAlign: 'center', marginTop: 12 }]}>You&apos;re in. Waiting on {party.members.length - inCount} more.</Text>
        : <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1 }}><Button variant="primary" size="lg" icon="check" disabled={busy} onPress={() => answer('accept')} testID="accept-party">I&apos;m in</Button></View>
          <Button size="lg" block={false} disabled={busy} onPress={() => answer('decline')} testID="decline-party">Not for me</Button>
        </View>}
      <Text style={[t.meta, { textAlign: 'center', marginTop: 8 }]}>Nobody is told who said no. If this squad doesn&apos;t come together, you keep your place in line.</Text>
    </Section>
    <Section title="Your squad">
      {party.members.map(m => <View key={m.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <Avatar name={m.user.name} color={m.user.avatarColor} size={40} dim={!m.acceptedAt} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={t.bodyBold}>{m.user.id === meId ? 'You' : m.user.name}{isSample(m.user, meId) ? <Text style={[t.meta, { fontSize: 11 }]}>  Sample</Text> : null}</Text>
          {m.user.id !== meId ? <Text numberOfLines={1} style={t.meta}>{m.shared?.length ? `You both like ${m.shared.join(', ')}` : 'New to you'}</Text> : null}
        </View>
        {m.acceptedAt ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Icon name="check" size={14} color={c.positive} /><Text style={[t.meta, { color: c.positive, fontFamily: font.semibold }]}>In</Text></View> : null}
      </View>)}
    </Section>
    {party.event ? <Section><DateLine start={party.event.startsAt} /><Text style={t.title}>{party.event.title}</Text><Text style={t.meta}>{party.event.venueName}</Text></Section> : null}
  </Screen>;
}

function SquadFound({ party, meId }: { party: Party; meId: string }) {
  const hangout = party.event?.kind === 'hangout';
  const others = party.members.filter(m => m.user.id !== meId);
  const hasSample = party.members.some(m => isSample(m.user, meId));
  return <Screen title="Your squad" back="/events" testID="party-found">
    <Section style={{ alignItems: 'center', paddingTop: 24 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={48} color={c.surface} /></View>
      <Text style={[t.page, { marginTop: 16 }]}>Your squad is ready</Text>
      <Text style={[t.body, { color: c.muted, marginTop: 4, textAlign: 'center' }]}>{party.members.length} people{party.event ? (hangout ? ' · a new hangout, just for you' : ` going to ${party.event.title} together`) : ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {party.members.map(m => <View key={m.user.id} style={{ width: 56, alignItems: 'center', gap: 4 }}>
          <Avatar name={m.user.name} color={m.user.avatarColor} size={48} />
          <Text numberOfLines={1} style={[t.meta, { color: c.ink }]}>{m.user.id === meId ? 'You' : first(m.user.name)}</Text>
          {isSample(m.user, meId) ? <Text style={{ fontSize: 11, color: c.muted }}>Sample</Text> : null}
        </View>)}
      </View>
      {hasSample ? <Text style={[t.meta, { marginTop: 8, textAlign: 'center' }]}>Sample people are simulated so the demo works with a small crowd.</Text> : null}
    </Section>
    {party.event ? <Section>
      <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: c.control }}>
        {party.event.coverColor ? <Cover color={party.event.coverColor} src={`/images/covers/${party.event.id}.webp`} height={72} /> : null}
        <View style={{ padding: 12 }}>
          <DateLine start={party.event.startsAt} />
          <Text style={t.title} onPress={() => router.push(`/events/${party.event!.id}`)}>{party.event.title}</Text>
          <Text style={t.meta}>{party.event.venueName}</Text>
          {hangout && party.event.description ? <Text style={[t.meta, { marginTop: 4 }]}>{party.event.description}</Text> : null}
        </View>
      </View>
    </Section> : null}
    <SquadDecision partyId={party.id} />
    <View style={{ backgroundColor: c.surface }}><Row testID="trace-toggle" icon="list" title="How we matched you" subtitle="What code checked and what AI wrote" onPress={() => router.push(`/squad/${party.id}/trace`)} trailing={<Icon name="chevron-right" color={c.muted} />} /></View>
    <Section>
      {party.chat ? <Button variant="primary" size="lg" onPress={() => router.push(`/chats/${party.chat!.id}`)} testID="open-squad-chat">Open squad chat</Button>
        : <Button variant="primary" size="lg" onPress={() => router.push(`/squad/${party.id}`)}>See your squad</Button>}
      <Text style={[t.meta, { textAlign: 'center', marginTop: 8 }]}>{others.length} {others.length === 1 ? 'person' : 'people'} will see your first name and what you have in common. Leave any time.</Text>
    </Section>
  </Screen>;
}
