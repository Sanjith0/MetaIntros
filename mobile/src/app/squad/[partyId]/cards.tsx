import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { stripCitations } from '../../../qu/citations';
import { Avatar, ErrorNote, Icon, Loading, Screen, c, font, t, type IconName } from '../../../qu/ui';

interface Claim { kind: string; text: string; sources: string[] }
interface Card {
  subject: { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean };
  content: { claims: Claim[]; openers: string[] };
  preChat?: { meIsA: boolean; transcript: { speaker: 'A' | 'B'; text: string }[]; sparks: string[] } | null;
}
const KIND_ICON: Record<string, IconName> = { shared_interest: 'tag', mutual_friends: 'users', event_overlap: 'calendar', pattern: 'grid', spark: 'zap' };
const first = (n: string) => n.split(' ')[0];
function humanSource(src: string, meId: string) {
  if (src === 'mutualFriends') return 'mutual friends';
  if (src.startsWith('preChat:')) return 'Companion conversation (AI)';
  const [uid, field = ''] = src.split(':');
  const f = field.replace(/\[\d+\]/, '');
  const name = ({ likes: 'likes', groups: 'groups', music: 'music', events: 'events', x_not_interested: 'not-interested list', socialStyle: 'activity pattern', availability: 'availability' } as Record<string, string>)[f] ?? f;
  return `${uid === meId ? 'your' : 'their'} ${name}`;
}

/** Talk cards: one card per squadmate, with the facts each line came from and suggested openers. */
export default function TalkCards() {
  const { partyId, member } = useLocalSearchParams<{ partyId: string; member?: string }>();
  const { data, error, reload } = useData<{ meId: string; eventTitle: string; cards: Card[] }>(`/api/m/squad/${partyId}/cards`);
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 520);
  const strip = useRef<{ scrollTo: (o: { x: number; animated: boolean }) => void } | null>(null);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [openPre, setOpenPre] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const i = Math.max(0, data.cards.findIndex(x => x.subject.id === member));
    setActive(i);
    setTimeout(() => strip.current?.scrollTo({ x: i * pageW, animated: false }), 50);
  }, [data, member, pageW]);
  if (!data) return <Screen title="Talk cards" back={`/squad/${partyId}`}>{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const goTo = (i: number) => { setActive(i); strip.current?.scrollTo({ x: i * pageW, animated: true }); };
  const copy = (o: string) => {
    const text = stripCitations(o);
    if (Platform.OS === 'web') navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(o); setTimeout(() => setCopied(null), 2000);
  };
  return <Screen title="Talk cards" back={`/squad/${partyId}`} testID="talk-cards">
    <View style={{ backgroundColor: c.surface, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 }}>
      <Text style={t.meta}>{data.eventTitle} · what you have in common with each person</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 8 }}>
        {data.cards.map((x, i) => <Pressable key={x.subject.id} onPress={() => goTo(i)} style={{ width: 56, alignItems: 'center', gap: 4 }}>
          <View style={{ borderRadius: 26, borderWidth: 2, borderColor: i === active ? c.accent : 'transparent', padding: 2 }}><Avatar name={x.subject.name} color={x.subject.avatarColor} size={44} /></View>
          <Text numberOfLines={1} style={[t.meta, i === active && { color: c.ink, fontFamily: font.semibold }]}>{first(x.subject.name)}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    <ScrollView ref={strip as never} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e => setActive(Math.round(e.nativeEvent.contentOffset.x / pageW))}
      onScroll={Platform.OS === 'web' ? e => setActive(Math.round(e.nativeEvent.contentOffset.x / pageW)) : undefined} scrollEventThrottle={100}>
      {data.cards.map(x => <View key={x.subject.id} style={{ width: pageW, paddingHorizontal: 12 }} testID={`talk-card-${x.subject.id}`}>
        <View style={{ backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: c.control }}>
            <Avatar name={x.subject.name} color={x.subject.avatarColor} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={t.meta}>You and</Text>
              <Text numberOfLines={1} style={t.headline}>{x.subject.name}</Text>
              {x.subject.isSimulated && !x.subject.isLive ? <Text style={t.meta}>Sample person</Text> : null}
            </View>
          </View>
          <View style={{ padding: 16, gap: 16 }}>
            <View style={{ gap: 10 }}>
              <Text style={t.bodyBold}>What you have in common</Text>
              {x.content.claims.map((cl, i) => <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name={KIND_ICON[cl.kind] ?? 'tag'} size={16} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={t.body}>{stripCitations(cl.text)}</Text>
                  <Text style={t.meta}>From {cl.sources.map(s => humanSource(s, data.meId)).join(', ')}</Text>
                </View>
              </View>)}
              {x.content.claims.length === 0 ? <Text style={[t.body, { color: c.muted }]}>Nothing on file yet. You&apos;ll find out together.</Text> : null}
            </View>
            <View style={{ gap: 8 }}>
              <Text style={t.bodyBold}>Try opening with</Text>
              <View style={{ backgroundColor: c.wash, borderRadius: 8 }}>
                {x.content.openers.map(o => <Pressable key={o} onPress={() => copy(o)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Text style={[t.body, { flex: 1 }]}>{stripCitations(o)}</Text>
                  <Icon name={copied === o ? 'check' : 'copy'} size={16} color={copied === o ? c.positive : c.muted} />
                </Pressable>)}
              </View>
              {copied ? <Text style={t.meta}>Copied. Paste it in your squad chat.</Text> : null}
            </View>
            {x.preChat ? <View style={{ backgroundColor: c.wash, borderRadius: 8, padding: 12, gap: 6 }}>
              <Pressable onPress={() => setOpenPre(openPre === x.subject.id ? null : x.subject.id)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={t.bodyBold}>What your Companions talked about</Text><Text style={t.meta}>AI simulation</Text>
              </Pressable>
              {openPre === x.subject.id ? <>
                <Text style={t.meta}>Your Companion AI and theirs talked before you were matched. Each knew only its own person, and only what they chose to share. These are not real messages.</Text>
                {x.preChat.transcript.map((line, i) => {
                  const mine = (line.speaker === 'A') === x.preChat!.meIsA;
                  return <View key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <Text style={[t.meta, { fontSize: 12, textAlign: mine ? 'right' : 'left' }]}>{mine ? 'Your Companion' : `${first(x.subject.name)}'s Companion`}</Text>
                    <View style={{ backgroundColor: mine ? c.accent : c.surface, borderRadius: 16, padding: 10 }}><Text style={[t.body, { color: mine ? c.surface : c.ink }]}>{stripCitations(line.text)}</Text></View>
                  </View>;
                })}
              </> : null}
            </View> : null}
            <Text style={t.meta}>AI · Openers written by AI from the facts above. Politics, religion, health and sexuality are never used.</Text>
          </View>
        </View>
      </View>)}
    </ScrollView>
    <Text style={[t.meta, { textAlign: 'center', marginTop: 12 }]}>{data.cards.length ? `${active + 1} of ${data.cards.length}` : 'No cards yet'}</Text>
  </Screen>;
}
