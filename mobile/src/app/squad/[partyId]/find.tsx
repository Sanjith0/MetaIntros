import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { pickPhotos } from '../../../qu/pickPhotos';
import { Avatar, Button, Icon, Loading, Row, Screen, c, font, t } from '../../../qu/ui';
import { SvgImage } from '../../../qu/SvgImage';

interface Arrival { id: string; name: string; avatarColor: string; checkedInAt: string | null; photoUrl: string | null; isSimulated?: boolean; isLive?: boolean }
interface Info { meId: string; event: { venueName: string; lat: number; lng: number } }

/** A schematic street map with one pin at the meeting point (no tiles, no live location), as on the web app. */
const MAP = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><rect width="320" height="120" fill="#f0f2f5"/>'
  + [20, 60, 100].map(y => `<line x1="0" x2="320" y1="${y}" y2="${y}" stroke="#fff" stroke-width="8"/>`).join('')
  + [40, 120, 200, 280].map(x => `<line y1="0" y2="120" x1="${x}" x2="${x}" stroke="#fff" stroke-width="8"/>`).join('')
  + '<rect x="128" y="28" width="64" height="24" rx="4" fill="#e4e6eb"/><circle cx="160" cy="60" r="16" fill="#e41e3f" opacity="0.15"/>'
  + '<path d="M160 40c-7 0-12 5-12 12 0 9 12 20 12 20s12-11 12-20c0-7-5-12-12-12z" fill="#e41e3f"/><circle cx="160" cy="52" r="4" fill="#fff"/></svg>');

/** Find each other (components/chat/FindYourParty.tsx): the meeting spot, "I'm here", an optional photo, and who has arrived. */
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
  const photo = async () => {
    if (me?.photoUrl) { await postJSON(`/api/party/${partyId}/photo`, { dataUrl: null }); return reload(); }
    const [p] = await pickPhotos({ multiple: false, capture: true, max: 256 });
    if (typeof p === 'string') await postJSON(`/api/party/${partyId}/photo`, { dataUrl: p });
    reload();
  };
  return <Screen title="Find each other" back={`/squad/${partyId}`} testID="find-each-other">
    <View testID="find-your-party" style={{ backgroundColor: c.surface }}>
      <Pressable testID="meeting-pin" accessibilityLabel={`Map: ${spot}`} onPress={() => Linking.openURL(`https://maps.google.com/?q=${ev.lat},${ev.lng}`)}>
        <SvgImage xml={MAP} width="100%" height={120} />
        <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Icon name="navigation" size={12} /><Text style={[t.meta, { color: c.ink, fontFamily: font.semibold }]}>Directions</Text>
        </View>
      </Pressable>
      <View style={{ padding: 16, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="map-pin" size={18} color={c.badge} /><Text style={t.title}>{spot}</Text></View>
        <Text style={t.meta}>Your squad meets here, then walks in together.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button variant={me?.checkedInAt ? 'on' : 'primary'} icon={me?.checkedInAt ? 'check' : 'map-pin'} disabled={busy} testID="im-here"
            onPress={async () => { if (me?.checkedInAt) return; setBusy(true); await postJSON(`/api/party/${partyId}/checkin`); setBusy(false); reload(); }}>
            {me?.checkedInAt ? "You're here" : "I'm here"}
          </Button></View>
          <View style={{ flex: 1 }}><Button testID="photo-opt-in" icon="camera" onPress={photo}>{me?.photoUrl ? 'Remove photo' : 'Share a photo'}</Button></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}><Icon name="shield" size={14} color={c.muted} /><Text style={[t.meta, { flex: 1 }]}>A photo helps your squad spot you. Only this squad sees it, and it&apos;s deleted when the chat ends.</Text></View>
      </View>
    </View>
    <View style={{ backgroundColor: c.surface, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 }}>
        <Text style={t.title}>Who&apos;s here</Text>
        <Text testID="arrival-count" style={[t.meta, { color: c.positive, fontFamily: font.semibold }]}>{here} of {list.length} here</Text>
      </View>
      <View testID="arrival-list">
        {list.map(a => <Row key={a.id} testID="arrival" leading={<View>
          <Avatar name={a.name} color={a.avatarColor} photoUrl={a.photoUrl} dim={!a.checkedInAt} />
          {a.checkedInAt ? <View style={{ position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: c.positive, borderWidth: 2, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={9} color={c.surface} /></View> : null}
        </View>}
          title={a.id === meId ? 'You' : a.name.split(' ')[0]} subtitle={`${a.checkedInAt ? 'Here' : 'On the way'}${a.id !== meId && a.isSimulated && !a.isLive ? ' · Sample person' : ''}`} />)}
      </View>
    </View>
  </Screen>;
}
