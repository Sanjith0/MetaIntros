import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { Avatar, Button, Loading, Row, Screen, Section, c, t } from '../../../qu/ui';

interface Member { id: string; name: string; avatarColor: string; isSimulated?: boolean; state: 'add' | 'requested' | 'incoming' | 'friends' | 'unavailable'; sharedNote: string | null }
interface Data { partyId: string; eventTitle: string; over: boolean; members: Member[] }

/** After the event: add squadmates. Only mutual adds connect. */
export default function SquadConnect() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data, reload } = useData<Data>(`/api/squad/${partyId}/connect`, 3000);
  if (!data) return <Screen title="Stay in touch" back={`/squad/${partyId}`}><Loading /></Screen>;
  const add = async (id: string) => { await postJSON(`/api/squad/${partyId}/connect`, { toId: id }); reload(); };
  return <Screen title="Stay in touch" back={`/squad/${partyId}`} testID="squad-connect">
    <Section>
      <Text style={t.headline}>After {data.eventTitle}</Text>
      <Text style={[t.body, { color: c.muted, marginTop: 4 }]}>You only become friends if you both tap Add friend. Nobody is told if you don&apos;t.</Text>
      {!data.over ? <Text style={[t.meta, { backgroundColor: c.wash, padding: 12, borderRadius: 8, marginTop: 8 }]}>Friend requests open after the event.</Text> : null}
    </Section>
    <Section flush>
      {data.members.map(m => <Row key={m.id} testID={`connect-${m.id}`} leading={<Avatar name={m.name} color={m.avatarColor} size={56} />} title={m.name}
        subtitle={(m.sharedNote ? `You both love ${m.sharedNote}` : `Met at ${data.eventTitle}`) + (m.isSimulated ? ' · Sample person' : '')}
        trailing={<View>{m.state === 'friends' ? <Button variant="on" block={false} icon="check" disabled onPress={() => {}}>Friends</Button>
          : m.state === 'requested' ? <Button block={false} icon="clock" disabled onPress={() => {}}>Requested</Button>
          : m.state === 'unavailable' ? <Text style={t.meta}>Unavailable</Text>
          : <Button variant="primary" block={false} icon="user-plus" disabled={!data.over} onPress={() => add(m.id)} testID={`add-${m.id}`}>{m.state === 'incoming' ? 'Confirm' : 'Add friend'}</Button>}</View>} />)}
    </Section>
  </Screen>;
}
