import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { Avatar, Button, Icon, Loading, Row, Screen, Section, c, font, t } from '../../../qu/ui';

interface Arrival { id: string; name: string; avatarColor: string; checkedInAt: string | null; photoUrl: string | null; isSimulated?: boolean; isLive?: boolean }
interface Info { meId: string; event: { venueName: string; lat: number; lng: number } }

/** Find each other: the meeting spot, "I'm here", and who has arrived. */
export default function FindEachOther() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const info = useData<Info>(`/api/m/squad/${partyId}`);
  const { data: list, reload } = useData<Arrival[]>(`/api/party/${partyId}/checkin`, 3000);
  const [busy, setBusy] = useState(false);
  if (!info.data || !list) return <Screen title="Find each other" back={`/squad/${partyId}`}><Loading /></Screen>;
  const meId = info.data.meId;
  const ev = info.data.event;
  const spot = `Front entrance, ${ev.venueName}`;
  const me = list.find(a => a.id === meId);
  const here = list.filter(a => a.checkedInAt).length;
  return <Screen title="Find each other" back={`/squad/${partyId}`} testID="find-your-party">
    <Section>
      <View style={{ height: 120, borderRadius: 8, backgroundColor: c.on, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Icon name="map-pin" size={32} color={c.badge} />
        <Text style={[t.meta, { color: c.link, fontFamily: font.semibold }]} onPress={() => Linking.openURL(`https://maps.google.com/?q=${ev.lat},${ev.lng}`)}>Directions</Text>
      </View>
      <Text style={[t.title, { marginTop: 12 }]}>{spot}</Text>
      <Text style={t.meta}>Your squad meets here, then walks in together.</Text>
      <View style={{ marginTop: 12 }}>
        <Button variant={me?.checkedInAt ? 'on' : 'primary'} icon={me?.checkedInAt ? 'check' : 'map-pin'} disabled={busy} testID="im-here"
          onPress={async () => { if (me?.checkedInAt) return; setBusy(true); await postJSON(`/api/party/${partyId}/checkin`); setBusy(false); reload(); }}>
          {me?.checkedInAt ? "You're here" : "I'm here"}
        </Button>
      </View>
    </Section>
    <Section flush title="Who's here">
      <Text style={[t.meta, { color: c.positive, fontFamily: font.semibold, paddingHorizontal: 16, marginBottom: 4 }]}>{here} of {list.length} here</Text>
      {list.map(a => <Row key={a.id} leading={<Avatar name={a.name} color={a.avatarColor} photoUrl={a.photoUrl} dim={!a.checkedInAt} />}
        title={a.id === meId ? 'You' : a.name.split(' ')[0]} subtitle={`${a.checkedInAt ? 'Here' : 'On the way'}${a.id !== meId && a.isSimulated && !a.isLive ? ' · Sample person' : ''}`} />)}
    </Section>
  </Screen>;
}
