import React from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../qu/hooks';
import { Avatar, Button, ErrorNote, Loading, Row, Screen, Section, t } from '../../qu/ui';

interface Party { id: string; members: { user: { id: string; name: string; avatarColor: string } }[]; event: { id: string; title: string } | null; chat: { id: string } | null }

/** Squad page: who is in it and the way into the chat. The web app's tabs (find each other, talk cards) come later. */
export default function SquadScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data, error, reload } = useData<Party>(`/api/party/${partyId}`);
  if (!data) return <Screen title="Your squad" back="/events">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  return <Screen title="Your squad" back="/events">
    {data.event ? <Section><Text style={t.headline} onPress={() => router.push(`/events/${data.event!.id}`)}>{data.event.title}</Text></Section> : null}
    <Section flush title="Members">
      {data.members.map(m => <Row key={m.user.id} leading={<Avatar name={m.user.name} color={m.user.avatarColor} />} title={m.user.name} />)}
    </Section>
    {data.chat ? <Section><Button variant="primary" size="lg" onPress={() => router.push(`/chats/${data.chat!.id}`)}>Open squad chat</Button></Section> : null}
  </Screen>;
}
