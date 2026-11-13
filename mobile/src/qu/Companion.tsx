import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { getJSON, postJSON } from './api';
import { stripCitations } from './citations';
import { Avatar, Button, Icon, Section, c, font, t } from './ui';

export interface ThreadLine { from: 'me' | 'them'; kind: string; say: string; blocked: boolean }
interface Notes { score: number; wouldEnjoy: string[]; concerns: string[]; needs: string[] }
type People = Record<string, { name: string; avatarColor: string; anonymous?: boolean; age?: number; about?: string; traits?: string[] }>;
interface CheckInView {
  id: string; kind: 'picks' | 'objection'; secondsLeft: number;
  picks?: { targetSize: number; picks: { id: string; score: number; why: string; enjoy?: string[]; concerns?: string[]; needs?: string[] }[] };
  objection?: { items: { with: string; activity: string; asked: string }[] };
}
interface FeedView {
  stage: string | null; circle?: { theme: string; size: number } | null; people?: People;
  conversations?: { with: string; deep: boolean; notes: Notes | null; lines: ThreadLine[] }[];
  proposals?: { by: string; members: string[]; line: string; backers: number }[];
  groups?: { members: string[]; lines: { from: string; say: string }[]; status: string }[];
  checkIn?: CheckInView | null;
}
const first = (n?: string) => (n ?? 'Someone').split(' ')[0];
const Box = ({ children }: { children: React.ReactNode }) => <View style={{ backgroundColor: c.wash, borderRadius: 8, padding: 10, gap: 4 }}>{children}</View>;

export function Thread({ lines, otherName }: { lines: ThreadLine[]; otherName: string }) {
  return <View style={{ gap: 6 }}>
    {lines.filter(l => !l.blocked).map((l, i) => <View key={i} style={{ alignSelf: l.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: l.from === 'me' ? c.on : c.bubbleIn, borderRadius: 14, padding: 10 }}>
      <Text style={[t.meta, { fontFamily: font.semibold }]}>{l.from === 'me' ? 'Your Companion' : `${otherName}'s Companion`}</Text>
      <Text style={t.body}>{stripCitations(l.say)}</Text>
    </View>)}
  </View>;
}

function CheckInCard({ checkIn, people, threads, onSent }: { checkIn: CheckInView; people: People; threads: Record<string, ThreadLine[]>; onSent: () => void }) {
  const [left, setLeft] = useState(checkIn.secondsLeft);
  const [drop, setDrop] = useState<string[]>([]);
  const [up, setUp] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [told, setTold] = useState('');
  const [sent, setSent] = useState<null | 'sent' | 'error' | 'sensitive'>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLeft(checkIn.secondsLeft); setSent(null); setDrop([]); setUp([]); setTold(''); setOpen(null);
    const timer = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000); return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn.id]);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await postJSON<{ error?: string }>('/api/queue/checkin', { id: checkIn.id, ...body });
    setBusy(false);
    if (r.ok) { onSent(); setSent('sent'); return; }
    setSent(r.data?.error === 'sensitive' ? 'sensitive' : 'error');
  };
  const name = (id: string) => first(people[id]?.name);
  if (sent === 'sent') return <CheckInSent />;
  const countdown = <Text style={t.meta}>{left > 0 ? `Your Companion goes ahead on its own in ${left}s` : 'Your Companion is going ahead'}</Text>;
  return <View testID="checkin-card" style={{ borderWidth: 1, borderColor: c.accent, borderRadius: 8, padding: 12, marginTop: 12, gap: 6 }}>
    {checkIn.kind === 'picks' && checkIn.picks ? <>
      <Text style={t.title}>Your Companion is checking with you</Text>
      <Text style={[t.body, { color: c.muted }]}>Here&apos;s who it would put in your squad of {checkIn.picks.targetSize}. Tap someone to read what your Companion learned. Drop anyone you don&apos;t want.</Text>
      {countdown}
      {checkIn.picks.picks.map(p => {
        const out = drop.includes(p.id), isOpen = open === p.id;
        return <View key={p.id} testID="checkin-pick" style={{ paddingVertical: 6, gap: 6, borderTopWidth: 1, borderTopColor: c.control }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: out ? 0.5 : 1 }}>
            <Pressable onPress={() => setOpen(isOpen ? null : p.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar name={people[p.id]?.name ?? '?'} color={people[p.id]?.avatarColor} size={40} blurred={people[p.id]?.anonymous} />
              <View style={{ flex: 1 }}>
                <Text style={t.bodyBold}>{name(p.id)} <Text style={t.meta}>· {p.score}</Text></Text>
                {p.why ? <Text numberOfLines={isOpen ? undefined : 1} style={t.meta}>{stripCitations(p.why)}</Text> : null}
              </View>
              <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
            </Pressable>
            <Button block={false} testID="checkin-drop" onPress={() => setDrop(d => (out ? d.filter(x => x !== p.id) : [...d, p.id]))}>{out ? 'Undo' : 'Drop'}</Button>
          </View>
          {isOpen ? <View style={{ gap: 6 }}>
            <Box>
              <Text style={[t.meta, { fontFamily: font.semibold }]}>Your Companion&apos;s private read on {name(p.id)}</Text>
              {(p.enjoy ?? []).map((x, i) => <Text key={`e${i}`} style={t.body}>You&apos;d enjoy: {stripCitations(x)}</Text>)}
              {(p.concerns ?? []).map((x, i) => <Text key={`c${i}`} style={t.body}>Watch out: {stripCitations(x)}</Text>)}
              {(p.needs ?? []).map((x, i) => <Text key={`n${i}`} style={t.body}>You&apos;d need: {stripCitations(x)}</Text>)}
            </Box>
            {threads[p.id]?.length ? <Thread lines={threads[p.id]} otherName={name(p.id)} /> : null}
          </View> : null}
        </View>;
      })}
      <Text style={[t.bodyBold, { marginTop: 6 }]}>Anything it got wrong about you, or what you actually want?</Text>
      <TextInput testID="checkin-told" value={told} onChangeText={v => setTold(v.slice(0, 200))} multiline placeholder="e.g. I'm not low-key tonight, I want to dance" placeholderTextColor={c.muted}
        style={[t.body, { backgroundColor: c.wash, borderRadius: 6, padding: 10, minHeight: 50 }]} />
      <Text style={t.meta}>Only your Companion reads this, and it remembers it for next time.</Text>
      {sent === 'sensitive' ? <Text style={[t.meta, { color: c.badge }]}>Keep it to plans and vibe: no health, religion, politics or sexuality.</Text> : null}
      {sent === 'error' ? <Text style={t.meta}>Too late or couldn&apos;t send. Your Companion went ahead.</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button disabled={busy} testID="checkin-looks-right" onPress={() => send({ drop: [] })}>Looks right</Button></View>
        <View style={{ flex: 1 }}><Button variant="primary" disabled={busy || (!drop.length && !told.trim())} testID="checkin-send" onPress={() => send({ drop, told })}>Send</Button></View>
      </View>
    </> : null}
    {checkIn.kind === 'objection' && checkIn.objection ? <>
      <Text style={t.title}>Quick question from your Companion</Text>
      <Text style={[t.body, { color: c.muted }]}>Before it says no for you, it wants to check.</Text>
      {countdown}
      {checkIn.objection.items.map(o => {
        const yes = up.includes(o.with);
        return <View key={o.with} style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.control }}>
          <Text style={t.body}><Text style={t.bodyBold}>{name(o.with)}&apos;s Companion asked:</Text> “{stripCitations(o.asked)}”</Text>
          <Text style={t.body}>Your Companion thinks you wouldn&apos;t be into <Text style={t.bodyBold}>{o.activity}</Text>. Would you?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant={yes ? 'secondary' : 'primary'} onPress={() => setUp(u => u.filter(x => x !== o.with))}>Not for me</Button></View>
            <View style={{ flex: 1 }}><Button variant={yes ? 'primary' : 'secondary'} onPress={() => setUp(u => (yes ? u : [...u, o.with]))}>I&apos;d be up for it</Button></View>
          </View>
        </View>;
      })}
      <Button variant="primary" disabled={busy} onPress={() => send({ up })} testID="objection-send">Send</Button>
    </> : null}
  </View>;
}

function CheckInSent() {
  return <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: c.wash, borderRadius: 8, padding: 12, marginTop: 12 }}>
    <Icon name="check" size={16} color={c.positive} /><Text style={t.body}>Got it. Your Companion is using what you said.</Text>
  </View>;
}

/** "Your Companion is talking" while the queue runs (components/companion/CompanionFeed.tsx on the web app). */
export function CompanionFeed({ meId }: { meId?: string }) {
  const [view, setView] = useState<FeedView | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const load = useCallback(async () => { const v = await getJSON<FeedView>('/api/queue/companion').catch(() => null); if (v) setView(v); }, []);
  useEffect(() => { load(); const timer = setInterval(load, 1200); return () => clearInterval(timer); }, [load]);
  if (!view?.stage || !view.conversations) return null;
  const people = view.people ?? {};
  const name = (id: string) => first(people[id]?.name);
  const convs = view.conversations;
  const shownOpen = open ?? convs[0]?.with ?? null;
  return <Section title="Your Companion is talking" testID="companion-feed">
    <Text style={[t.body, { color: c.muted }]}>It speaks for you to the other people&apos;s Companions{view.circle ? ` in your group of ${view.circle.size}` : ''}, using only what you chose to share. AI</Text>
    {view.checkIn ? <CheckInCard key={view.checkIn.id} checkIn={view.checkIn} people={people} threads={Object.fromEntries(convs.map(x => [x.with, x.lines]))} onSent={() => setSentAt(Date.now())} />
      : sentAt > 0 && Date.now() - sentAt < 4000 ? <CheckInSent /> : null}
    <Text style={[t.meta, { marginTop: 12 }]}>{convs.length} {convs.length === 1 ? 'conversation' : 'conversations'}</Text>
    {convs.map(cv => {
      const isOpen = shownOpen === cv.with;
      const last = cv.lines[cv.lines.length - 1];
      return <View key={cv.with} style={{ borderTopWidth: 1, borderTopColor: c.control, paddingVertical: 8, gap: 8 }}>
        <Pressable onPress={() => setOpen(isOpen ? '' : cv.with)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={people[cv.with]?.name ?? '?'} color={people[cv.with]?.avatarColor} size={40} blurred={people[cv.with]?.anonymous} />
          <View style={{ flex: 1 }}>
            <Text style={t.bodyBold}>{name(cv.with)}&apos;s Companion{cv.deep ? <Text style={[t.meta, { color: c.link }]}>  Going deeper</Text> : null}</Text>
            {!isOpen && last ? <Text numberOfLines={1} style={t.meta}>{last.from === 'me' ? 'Yours: ' : ''}{stripCitations(last.say)}</Text> : null}
          </View>
          {cv.notes ? <Text style={[t.meta, { fontFamily: font.semibold, color: c.link, backgroundColor: c.on, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }]}>{cv.notes.score}</Text> : null}
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
        </Pressable>
        {isOpen ? <>
          {people[cv.with]?.about ? <Box><Text style={[t.meta, { fontFamily: font.semibold }]}>{name(cv.with)}{people[cv.with]?.age ? `, ${people[cv.with]?.age}` : ''}{people[cv.with]?.traits?.length ? ` · ${people[cv.with]!.traits!.join(', ')}` : ''}</Text><Text style={t.body}>“{people[cv.with]!.about}”</Text></Box> : null}
          <Thread lines={cv.lines} otherName={name(cv.with)} />
          {cv.notes ? <Box>
            <Text style={[t.meta, { fontFamily: font.semibold }]}>Your Companion&apos;s private read</Text>
            {cv.notes.wouldEnjoy[0] ? <Text style={t.body}>You&apos;d enjoy: {stripCitations(cv.notes.wouldEnjoy[0])}</Text> : null}
            {cv.notes.concerns[0] ? <Text style={t.body}>Watch out: {stripCitations(cv.notes.concerns[0])}</Text> : null}
          </Box> : null}
        </> : null}
      </View>;
    })}
    {view.proposals?.length ? <Box>
      <Text style={t.bodyBold}>Squads proposed with you</Text>
      {view.proposals.map((p, i) => <Text key={i} style={t.body}><Text style={t.bodyBold}>{p.by === meId ? 'Your Companion' : `${name(p.by)}'s Companion`}:</Text> {p.members.map(m => (m === meId ? 'you' : name(m))).join(', ')}{p.backers > 0 ? ` · backed by ${p.backers}` : ''}</Text>)}
    </Box> : null}
    {view.groups?.map((g, i) => <View key={i} style={{ marginTop: 8 }}><Box>
      <Text style={t.bodyBold}>{g.status === 'didnt_work' ? "This group didn't work out. Looking again." : "Your squad's Companions are talking it over"}</Text>
      {g.status !== 'didnt_work' ? g.lines.map((l, j) => <Text key={j} style={t.body}><Text style={t.bodyBold}>{l.from === meId ? 'Your Companion' : `${name(l.from)}'s`}:</Text> {stripCitations(l.say)}</Text>) : null}
    </Box></View>)}
  </Section>;
}
