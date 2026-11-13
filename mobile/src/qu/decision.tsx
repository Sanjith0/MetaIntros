import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getJSON } from './api';
import { stripCitations } from './citations';
import { Thread, type ThreadLine } from './Companion';
import { AiLabel, Avatar, Icon, c, font, t } from './ui';

/* ---------- Search map (components/queue/SearchMap.tsx) ---------- */

export interface SearchAreaView {
  radiusKm: number;
  center: { id: string; name: string; lat: number; lng: number };
  areas: { id: string; name: string; lat: number; lng: number; km: number; inRange: boolean; waiting: number | null }[];
}
const EDGE_KM = 15, SIZE = 148, HALF = SIZE / 2, REACH = HALF - 8;
const toPx = (km: number) => Math.sqrt(Math.min(km, EDGE_KM) / EDGE_KM) * REACH;
const circle = (r: number) => ({ position: 'absolute' as const, left: HALF - r, top: HALF - r, width: r * 2, height: r * 2, borderRadius: r });

/** Where your search reaches: your area in the middle, others by real direction, and a ring that grows as the queue widens. Counts only, never faces. */
export function SearchMap({ area, me }: { area: SearchAreaView; me?: { name: string; avatarColor: string } }) {
  const ctr = area.center;
  const kx = 111 * Math.cos((ctr.lat * Math.PI) / 180);
  const spots = area.areas.filter(a => a.id !== ctr.id).map(a => {
    const dx = (a.lng - ctr.lng) * kx, dy = (a.lat - ctr.lat) * 111;
    const d = Math.hypot(dx, dy) || 1, r = toPx(a.km);
    return { ...a, x: HALF + (dx / d) * r, y: HALF - (dy / d) * r };
  });
  const ring = area.radiusKm > 0 ? toPx(area.radiusKm) : 18;
  const here = area.areas.find(a => a.id === ctr.id);
  const reached = [here, ...spots.filter(s => s.inRange).sort((a, b) => a.km - b.km)].filter((x): x is NonNullable<typeof x> => !!x);
  const shown = reached.slice(0, 4);
  return <View testID="search-map" style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: c.wash, borderRadius: 8, padding: 12 }}>
    <View style={{ width: SIZE, height: SIZE, borderRadius: HALF, overflow: 'hidden', backgroundColor: c.surface }}>
      {[1, 6, 15].map(km => <View key={km} style={[circle(toPx(km)), { borderWidth: 1, borderColor: c.divider }]} />)}
      <View testID="search-ring" style={[circle(ring), { borderWidth: 2, borderColor: c.accent, backgroundColor: c.on }]} />
      {spots.map(s => <View key={s.id} testID={s.inRange ? 'map-area-in' : 'map-area-out'} style={{ position: 'absolute', left: s.x - 5, top: s.y - 5, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.surface, backgroundColor: s.inRange ? c.accent : c.disabled }} />)}
      {me ? <View style={{ position: 'absolute', left: HALF - 15, top: HALF - 15, borderRadius: 15, borderWidth: 2, borderColor: c.surface }}><Avatar name={me.name} color={me.avatarColor} size={26} /></View> : null}
    </View>
    <View testID="search-caption" style={{ flex: 1, minWidth: 0 }}>
      <Text style={t.bodyBold}>Search area</Text>
      <Text style={t.meta}>{area.radiusKm === 0 ? 'Your area only' : `Within ${area.radiusKm} km of you`}</Text>
      <View testID="search-areas" style={{ marginTop: 8, gap: 4 }}>
        {shown.map(a => <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
          <Text numberOfLines={1} style={[t.meta, { color: c.ink, flexShrink: 1 }]}>{a.name}{a.waiting ? <Text style={t.meta}> · {a.waiting} queuing</Text> : null}</Text>
        </View>)}
        {reached.length > shown.length ? <Text style={[t.meta, { paddingLeft: 14 }]}>and {reached.length - shown.length} more</Text> : null}
      </View>
    </View>
  </View>;
}

/* ---------- How your Companions decided (components/companion/SquadDecision.tsx) ---------- */

interface Notes { score: number; wouldEnjoy: string[]; concerns: string[] }
interface Comparison { id: string; similarity: number; reason: string }
interface Recap {
  roomSize: number; circleTheme: string; talkedWith: number;
  squad: { id: string; deep: boolean; notes: Notes | null; thread: ThreadLine[] }[];
  groupChat: { from: string; say: string }[];
  numbers: { similarityPick: { id: string; similarity: number }[]; companionPick: string[]; passedOver: Comparison[]; chosenAnyway: Comparison[]; agreed: number };
}
interface Data { me: string; people: Record<string, { name: string; avatarColor: string; anonymous?: boolean }>; recap: Recap }

function ScorePill({ score }: { score: number }) {
  const hi = score >= 75;
  return <Text testID="companion-score" style={{ borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, fontFamily: font.semibold, fontSize: 13, backgroundColor: hi ? c.on : c.control, color: hi ? c.link : c.ink }}>{score}</Text>;
}
const Card = ({ children, testID }: { children: React.ReactNode; testID?: string }) => <View testID={testID} style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 12 }}>{children}</View>;

/** "How your Companions decided" and "The numbers vs your Companion", once the squad is ready. */
export function SquadDecision({ partyId }: { partyId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () => getJSON<Data>(`/api/party/${partyId}/companions`).then(d => { if (!stop && d?.recap) setData(d); }).catch(() => {});
    load();
    const tm = setTimeout(load, 1500); // the recap is written a moment after the squad locks
    return () => { stop = true; clearTimeout(tm); };
  }, [partyId]);
  if (!data) return null;
  const { me, people, recap } = data;
  const name = (id: string) => (people[id]?.name ?? 'Someone').split(' ')[0];
  const shownOpen = open ?? recap.squad[0]?.id ?? null;
  const n = recap.numbers;
  const differs = n.passedOver.length > 0 || n.chosenAnyway.length > 0;
  return <>
    <Card testID="squad-decision">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><Text style={t.title}>How your Companions decided</Text><AiLabel>AI</AiLabel></View>
      <Text style={[t.body, { color: c.muted }]}>Your Companion talked with {recap.talkedWith} {recap.talkedWith === 1 ? 'person' : 'people'} in a group of {recap.roomSize} and settled on this squad. Here&apos;s what it said with each of them.</Text>
      {recap.squad.map((s, i) => { const isOpen = shownOpen === s.id; return <View key={s.id} testID="decision-conversation" style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.divider, marginTop: i ? 0 : 8 }}>
        <Pressable accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? '' : s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 44 }}>
          <Avatar name={people[s.id]?.name ?? '?'} color={people[s.id]?.avatarColor} size={40} />
          <Text style={[t.bodyBold, { flex: 1 }]}>{name(s.id)}{s.deep ? <Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]}>  Went deeper</Text> : null}</Text>
          {s.notes ? <ScorePill score={s.notes.score} /> : null}
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
        </Pressable>
        {isOpen ? <View style={{ gap: 8, paddingBottom: 12 }}>
          <Thread lines={s.thread} otherName={name(s.id)} />
          {s.notes?.wouldEnjoy[0] ? <Text style={[t.body, { backgroundColor: c.wash, borderRadius: 8, padding: 10 }]}>Your Companion&apos;s read: {stripCitations(s.notes.wouldEnjoy[0])}</Text> : null}
        </View> : null}
      </View>; })}
      {recap.groupChat.length ? <View testID="decision-group" style={{ marginTop: 8, backgroundColor: c.wash, borderRadius: 8, padding: 12, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="message-square" size={16} /><Text style={t.bodyBold}>The squad&apos;s Companions talked it over</Text></View>
        {recap.groupChat.map((l, i) => <Text key={i} style={t.body}><Text style={t.bodyBold}>{l.from === me ? 'Your Companion' : `${name(l.from)}'s`}:</Text> {stripCitations(l.say)}</Text>)}
        <View testID="decision-signed" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}><Icon name="check-circle" size={14} color={c.positive} /><Text style={[t.meta, { color: c.positive, fontFamily: font.semibold }]}>All {recap.squad.length + 1} Companions said yes</Text></View>
      </View> : null}
    </Card>
    <Card testID="numbers-vs-companion">
      <Text style={[t.title, { marginBottom: 8 }]}>The numbers vs your Companion</Text>
      <Text style={[t.body, { color: c.muted }]}>Most matching apps turn profiles into vectors and pick whoever scores closest. Here&apos;s who that would have picked for you, and what your Companion found by actually talking.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View testID="similarity-pick" style={{ flex: 1, backgroundColor: c.wash, borderRadius: 8, padding: 10 }}>
          <Text style={[t.meta, { fontFamily: font.semibold, marginBottom: 4 }]}>Closest by similarity</Text>
          {n.similarityPick.map(x => { const kept = n.companionPick.includes(x.id); return <View key={x.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[t.body, !kept && { color: c.muted, textDecorationLine: 'line-through' }]}>{name(x.id)}</Text>
            <Text style={[t.body, !kept && { color: c.muted, textDecorationLine: 'line-through' }, { fontVariant: ['tabular-nums'] }]}>{x.similarity}%</Text>
          </View>; })}
        </View>
        <View testID="companion-pick" style={{ flex: 1, backgroundColor: c.wash, borderRadius: 8, padding: 10 }}>
          <Text style={[t.meta, { fontFamily: font.semibold, marginBottom: 4 }]}>Your Companions chose</Text>
          {n.companionPick.map(id => <Text key={id} style={n.similarityPick.some(x => x.id === id) ? t.body : [t.bodyBold, { color: c.link }]}>{name(id)}</Text>)}
        </View>
      </View>
      {differs ? <View testID="numbers-differences" style={{ gap: 8, marginTop: 8 }}>
        {n.passedOver.map(x => <View key={x.id} testID="passed-over" style={{ borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 10 }}>
          <Text style={t.bodyBold}>{name(x.id)}: {x.similarity}% similar, but not in your squad</Text><Text style={[t.body, { color: c.muted }]}>{stripCitations(x.reason)}</Text>
        </View>)}
        {n.chosenAnyway.map(x => <View key={x.id} testID="chosen-anyway" style={{ borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 10 }}>
          <Text style={t.bodyBold}>{name(x.id)}: only {x.similarity}% similar, but in your squad</Text><Text style={[t.body, { color: c.muted }]}>{stripCitations(x.reason)}</Text>
        </View>)}
      </View> : <Text testID="numbers-agree" style={[t.body, { color: c.muted, marginTop: 8 }]}>This time the numbers and your Companions agreed, and your Companions also checked the whole group works together.</Text>}
    </Card>
  </>;
}
