import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../qu/hooks';
import { postJSON } from '../qu/api';
import { Avatar, Button, ErrorNote, Icon, Loading, Row, Screen, Section, c, t } from '../qu/ui';

interface Profile { name: string; avatarColor: string; friends: number; squads: number; about: string | null; work: string | null; hometown: string | null; neighborhood: string | null; ageBand: string; isLive: boolean; shareQueue: boolean; interests: string[] }

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
        <Text style={[t.page, { marginTop: 8 }]}>{p.name}</Text>
        <Text style={[t.body, { color: c.muted }]}>{p.friends} friends</Text>
        {p.about ? <Text style={[t.body, { marginTop: 8 }]}>{p.about}</Text> : null}
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
      <Row icon="eye" title="Let friends see you're queuing" subtitle="They see the event and your area" trailing={<Switch value={share} onValueChange={async v => { setShare(v); await postJSON('/api/me/queue-visibility', { visibility: v ? 'friends' : 'off' }); }} />} />
    </Section>
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
