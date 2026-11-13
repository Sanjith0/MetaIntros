import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { AiLabel, Avatar, Button, ErrorNote, Icon, Loading, Row, Screen, Section, c, font, t, toast, type IconName } from '../qu/ui';

interface Profile { name: string; avatarColor: string; friends: number; squads: number; about: string | null; work: string | null; hometown: string | null; neighborhood: string | null; ageBand: string; isLive: boolean; shareQueue: boolean; interests: string[]; brief: { facts: Fact[]; communication: string } | null }

export default function ProfileScreen() {
  const { data: p, error, reload } = useData<Profile>('/api/m/profile');
  const [share, setShare] = useState(false);
  useEffect(() => { if (p) setShare(p.shareQueue); }, [p]);
  if (!p) return <Screen title="Profile" tabs>{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const chevron = <Icon name="chevron-right" color={c.muted} />;
  return <Screen title="Profile" tabs testID="profile-page">
    <View style={{ backgroundColor: c.surface, paddingBottom: 16 }}>
      <View style={{ height: 112, backgroundColor: c.control }} />
      <View style={{ marginTop: -52, paddingHorizontal: 16 }}>
        <View style={{ borderRadius: 56, borderWidth: 4, borderColor: c.surface, alignSelf: 'flex-start' }}><Avatar name={p.name} color={p.avatarColor} size={104} /></View>
        <Text testID="header-avatar-name" style={[t.page, { marginTop: 8 }]}>{p.name}</Text>
        <Text style={[t.body, { color: c.muted }]}>{p.friends} friends</Text>
        {p.about ? <Text testID="profile-about" style={[t.body, { marginTop: 8 }]}>{p.about}</Text> : null}
        <View style={{ marginTop: 12 }}><Button icon="edit-2" onPress={() => toast('Editing your profile is off in this prototype.')}>Edit profile</Button></View>
      </View>
    </View>
    <Section flush title="Details">
      {p.work ? <Row icon="briefcase" title={p.work} /> : null}
      <Row icon="map-pin" title={`Lives in ${p.neighborhood ?? 'the Bay Area'}`} />
      {p.hometown ? <Row icon="home" title={`From ${p.hometown}`} /> : null}
      <Row icon="gift" title={`Age ${p.ageBand}`} />
      <Row icon="users" title={`${p.squads} Queue Up squad${p.squads === 1 ? '' : 's'}`} onPress={() => router.push('/friends?tab=queueup')} trailing={chevron} />
    </Section>
    <Section flush title="Queue Up privacy">
      <Row testID="profile-queue-visibility" icon="eye" title="Let friends see when I'm queuing" subtitle={share ? 'Friends see which event and area. Never who else is in line.' : 'Off. Nobody sees your queues.'}
        trailing={<Switch testID="profile-queue-visibility-toggle" value={share} onValueChange={async v => { setShare(v); const r = await postJSON('/api/me/queue-visibility', { visibility: v ? 'friends' : 'off' }); if (!r.ok) setShare(!v); }} />} />
    </Section>
    {p.brief ? <BriefCard initial={p.brief.facts} communication={p.brief.communication} /> : null}
    <Section title="Interests">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {p.interests.map(x => <Text key={x} style={[t.body, { backgroundColor: c.control, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden' }]}>{x}</Text>)}
      </View>
    </Section>
    <Section flush>
      <Row icon="users" title="Friends" onPress={() => router.push('/friends')} trailing={chevron} />
      <Row icon="eye" title="Glance profile" subtitle="Your profile for meeting people in person" onPress={() => router.push('/glance/profile')} trailing={chevron} />
      <Row icon="sliders" title="Demo controls" subtitle="Reset, fast-forward, judges' QR" onPress={() => router.push('/demo')} trailing={chevron} testID="open-demo" />
    </Section>
    {p.isLive ? <Section title="Your demo data">
      <Text style={[t.meta, { marginBottom: 12 }]}>You signed up on this phone. Your data is deleted 24 hours after sign-up, or now if you prefer.</Text>
      <Button icon="trash-2" onPress={async () => { await fetch('/api/signup', { method: 'DELETE', credentials: 'include' }).catch(() => {}); router.replace('/join'); }}>Delete my data now</Button>
    </Section> : null}
  </Screen>;
}

type Share = 'open' | 'need_only' | 'private';
interface Fact { id: string; kind: 'interest' | 'group' | 'music' | 'event' | 'avoid' | 'style'; text: string; share: Share }
const KIND: Record<Fact['kind'], string> = { interest: 'Likes', group: 'Group', music: 'Music', event: 'Went to', avoid: 'Not into', style: 'Style' };
const OPTIONS: { value: Share; label: string; icon: IconName }[] = [
  { value: 'open', label: 'Share', icon: 'message-circle' }, { value: 'need_only', label: 'Only as a need', icon: 'help-circle' }, { value: 'private', label: 'Keep private', icon: 'eye-off' },
];

/** "What your Companion will say about you" (components/companion/BriefCard.tsx): fact by fact, what the Companion may share. */
function BriefCard({ initial, communication }: { initial: Fact[]; communication: string }) {
  const [facts, setFacts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const choose = async (f: Fact, share: Share) => {
    if (f.share === share) return;
    const before = facts;
    setFacts(fs => fs.map(x => (x.id === f.id ? { ...x, share } : x)));
    setError(null);
    const r = await postJSON('/api/companion/brief/share', { factId: f.id, share });
    if (!r.ok) { setFacts(before); setError("Couldn't save that. Try again."); }
  };
  const shared = facts.filter(f => f.share === 'open').length;
  return <Section title="What your Companion will say about you" testID="brief-card">
    <Text style={[t.body, { color: c.muted }]}>Your Companion speaks for you to other people&apos;s Companions to find who you&apos;d get along with. You decide what it can share.</Text>
    {communication ? <View testID="brief-communication" style={{ marginTop: 8, backgroundColor: c.wash, borderRadius: 8, padding: 10, gap: 4 }}><Text style={t.body}>&ldquo;{communication}&rdquo;</Text><AiLabel /></View> : null}
    <Text testID="brief-count" style={[t.meta, { marginTop: 8 }]}>{shared} of {facts.length} shared. Politics, religion, health and sexuality are never included.</Text>
    {error ? <Text accessibilityRole="alert" style={[t.meta, { color: c.badge, marginTop: 8 }]}>{error}</Text> : null}
    {facts.map((f, i) => <View key={f.id} testID="brief-fact" style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.divider }}>
      <Text style={t.body}><Text style={{ color: c.muted }}>{KIND[f.kind]} · </Text>{f.text}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {OPTIONS.map(o => { const on = f.share === o.value; return <Pressable key={o.value} testID={`brief-share-${o.value}`} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => choose(f, o.value)}
          style={{ flexGrow: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 18, backgroundColor: on ? c.on : c.control, paddingHorizontal: 16 }}>
          <Icon name={o.icon} size={14} color={on ? c.link : c.ink} /><Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 15, color: on ? c.link : c.ink }}>{o.label}</Text>
        </Pressable>; })}
      </View>
    </View>)}
  </Section>;
}
