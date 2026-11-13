import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { postJSON } from '../qu/api';
import { useData } from '../qu/hooks';
import { Button, Icon, Screen, Section, c, font, t } from '../qu/ui';
import { Chip } from '../qu/QueueSetup';

const BANDS = [{ id: '18-24', label: '18–24' }, { id: '25+', label: '25+' }, { id: 'under', label: 'Under 18' }];
const GENDERS: { id: string | null; label: string }[] = [{ id: 'woman', label: 'Woman' }, { id: 'man', label: 'Man' }, { id: 'nonbinary', label: 'Non-binary' }, { id: null, label: 'Prefer not to say' }];

/** Demo sign-up for judges' phones (app/join on the web app). No password, no account. */
export default function JoinScreen() {
  const { data: opts } = useData<{ chips: { tag: string; label: string }[]; slots: { id: string; label: string }[] }>('/api/m/signup-options');
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null | undefined>(undefined);
  const [womenOnly, setWomenOnly] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [avail, setAvail] = useState<string[]>(['sat-pm', 'sat-eve']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (xs: string[], set: (v: string[]) => void, x: string) => set(xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]);
  const minor = ageBand === 'under';
  const basicsOk = name.trim().length >= 2 && ageBand && !minor && gender !== undefined;
  const canWomenOnly = gender === 'woman';
  const submit = async (sample: boolean) => {
    setError(null);
    if (minor) return setError('Queue Up is for people 18 and over.');
    if (!basicsOk) return setError('Add your first name, age range and gender first.');
    if (!sample && interests.length < 5) return setError('Pick at least 5 interests.');
    setBusy(true);
    const body = sample ? { sample: true, name: name.trim(), ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly }
      : { name: name.trim(), ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly, interests, dislikes: [], availability: avail };
    const r = await postJSON<{ error?: string }>('/api/signup', body);
    if (!r.ok) { setBusy(false); return setError(r.data?.error ?? 'Something went wrong. Try again.'); }
    router.replace('/events');
  };
  return <Screen title="Join the Queue Up demo" testID="join-page">
    <Section style={{ gap: 8 }}>
      <Text style={t.body}>This is a demo sign-up for a hackathon prototype. It isn&apos;t Facebook and isn&apos;t connected to it. There&apos;s no password and no account.</Text>
      <Text style={t.meta}>We collect your first name, age range, gender (optional) and the interests you pick. If you&apos;re matched, your squad sees your first name and what you have in common. Everything is deleted 24 hours after you sign up, or when the demo resets.</Text>
    </Section>
    <Section style={{ gap: 8 }}>
      <Text style={t.bodyBold}>First name</Text>
      <TextInput testID="join-name" value={name} onChangeText={setName} placeholder="First name" placeholderTextColor={c.muted} maxLength={40} autoComplete="given-name"
        style={[t.body, { height: 44, borderRadius: 6, backgroundColor: c.wash, paddingHorizontal: 12 }]} />
      <Text style={[t.bodyBold, { marginTop: 8 }]}>Age range</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{BANDS.map(b => <Chip key={b.id} on={ageBand === b.id} onPress={() => setAgeBand(b.id)} testID={`join-age-${b.id}`}>{b.label}</Chip>)}</View>
      <Text style={[t.meta, minor && { color: c.badge, fontFamily: font.semibold }]}>{minor ? 'Queue Up is for people 18 and over.' : "You're only matched with people in your own age range."}</Text>
      <Text style={[t.bodyBold, { marginTop: 8 }]}>Gender</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{GENDERS.map(g => <Chip key={String(g.id)} on={gender === g.id} onPress={() => setGender(g.id)} testID={`join-gender-${g.id ?? 'none'}`}>{g.label}</Chip>)}</View>
      {canWomenOnly ? <Chip on={womenOnly} onPress={() => setWomenOnly(!womenOnly)} icon={womenOnly ? 'check-square' : 'square'}>Only match me into women-only squads</Chip> : null}
    </Section>
    <Section>
      <Button variant="primary" size="lg" disabled={busy} onPress={() => submit(true)} testID="join-sample">{busy ? 'Setting up…' : 'Start with sample interests'}</Button>
      <Text style={[t.meta, { textAlign: 'center', marginTop: 8 }]}>Fastest: we give you a sample set of interests under your first name.</Text>
      {error ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}><Icon name="alert-circle" size={14} color={c.badge} /><Text accessibilityRole="alert" style={[t.meta, { color: c.badge, fontFamily: font.semibold }]}>{error}</Text></View> : null}
    </Section>
    {opts ? <Section title="Or pick your own" style={{ gap: 8 }}>
      <Text style={t.bodyBold}>Things you&apos;re into <Text style={t.meta}>({interests.length} of 5+)</Text></Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{opts.chips.map(x => <Chip key={x.tag} on={interests.includes(x.tag)} onPress={() => toggle(interests, setInterests, x.tag)}>{x.label}</Chip>)}</View>
      <Text style={[t.bodyBold, { marginTop: 8 }]}>When are you free this weekend?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{opts.slots.map(s => <Chip key={s.id} on={avail.includes(s.id)} onPress={() => toggle(avail, setAvail, s.id)}>{s.label}</Chip>)}</View>
      <View style={{ marginTop: 8 }}><Button size="lg" disabled={busy} onPress={() => submit(false)} testID="join-submit">{busy ? 'Setting up…' : 'Join with these'}</Button></View>
    </Section> : null}
  </Screen>;
}
