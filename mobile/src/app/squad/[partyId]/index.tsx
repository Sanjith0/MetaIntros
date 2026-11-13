import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { fmtEventWhen, fmtTime } from '../../../qu/format';
import { Avatar, Button, ErrorNote, FacePile, Icon, Loading, Row, Screen, Section, Sheet, c, t, type IconName } from '../../../qu/ui';

interface Info {
  meId: string; partyId: string; name: string; status: string; chat: { id: string; archived: boolean } | null; sharePrompt: boolean; canLeave: boolean; ready: boolean; photos: number;
  event: { id: string; title: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string };
  members: { id: string; name: string; avatarColor: string; checkedIn: boolean; about: string | null; sample: boolean }[];
}

function Round({ label, icon, onPress, testID }: { label: string; icon: IconName; onPress: () => void; testID?: string }) {
  return <Pressable testID={testID} onPress={onPress} style={{ width: 80, alignItems: 'center', gap: 6 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} /></View>
    <Text style={[t.meta, { color: c.ink }]}>{label}</Text>
  </Pressable>;
}
const chevron = <Icon name="chevron-right" color={c.muted} />;

/** Squad info, modelled on Messenger's chat info. */
export default function SquadInfo() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data: p, error, reload } = useData<Info>(`/api/m/squad/${partyId}`);
  if (!p) return <Screen title="Squad info" back="/events">{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</Screen>;
  const others = p.members.filter(m => m.id !== p.meId);
  const base = `/squad/${p.partyId}`;
  return <Screen title="Squad info" back={p.chat ? `/chats/${p.chat.id}` : '/events'} testID="squad-info-page">
    <Section style={{ alignItems: 'center', paddingTop: 20 }}>
      <FacePile people={others} size={56} max={3} />
      <Text style={[t.headline, { marginTop: 12 }]}>{p.name}</Text>
      <Text style={t.meta}>{p.members.length} people · {p.chat?.archived ? 'chat ended' : 'chat ends 24h after the event'}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {p.chat ? <Round testID="info-chat" label="Chat" icon="message-circle" onPress={() => router.push(`/chats/${p.chat!.id}`)} /> : null}
        <Round testID="info-event" label="Event" icon="calendar" onPress={() => router.push(`/events/${p.event.id}`)} />
        <Round testID="info-find" label="I'm here" icon="map-pin" onPress={() => router.push(`${base}/find`)} />
      </View>
    </Section>
    {p.sharePrompt ? <Section testID="share-prompt">
      <Text style={t.title}>Share the outing</Text>
      <Text style={[t.meta, { marginVertical: 8 }]}>Post photos from your squad album, let the AI host suggest a post, or skip it. It&apos;s your call.</Text>
      <Button testID="open-share" variant="primary" onPress={() => router.push(`${base}/share`)}>Share the outing</Button>
    </Section> : null}
    {p.status === 'completed' || p.chat?.archived ? <Section>
      <Text style={t.title}>Stay in touch</Text>
      <Text style={[t.meta, { marginVertical: 8 }]}>Add your squad as friends. Only mutual adds connect.</Text>
      <Button variant="primary" icon="user-plus" onPress={() => router.push(`${base}/connect`)}>Add your squad as friends</Button>
    </Section> : null}
    <Section flush title="Plan">
      <Row icon="calendar" title={p.event.title} subtitle={fmtEventWhen(p.event.startsAt, p.event.endsAt)} onPress={() => router.push(`/events/${p.event.id}`)} />
      <Row icon="map-pin" title={`Meet at the front entrance, ${p.event.venueName}`} subtitle={p.event.venueAddress} onPress={() => router.push(`${base}/find`)} trailing={chevron} />
      <Row icon="clock" title={`Doors at ${fmtTime(new Date(p.event.startsAt))}`} subtitle="Meet 10 minutes early so you can walk in together." />
    </Section>
    <Section flush>
      {p.ready ? <Row testID="open-album" icon="image" title="Squad album" subtitle={p.photos ? `${p.photos} ${p.photos === 1 ? 'photo' : 'photos'} · only your squad can see them` : 'Add photos only your squad can see'} onPress={() => router.push(`${base}/album`)} trailing={chevron} /> : null}
      <Row icon="message-square" title="Talk cards" subtitle="What you have in common with each person" onPress={() => router.push(`${base}/cards`)} trailing={chevron} testID="open-talk-cards" />
      <Row icon="map-pin" title="Find each other" subtitle="Check in at the door and see who's here" onPress={() => router.push(`${base}/find`)} trailing={chevron} testID="open-find" />
      <Row icon="list" title="How we matched you" subtitle="What code checked, and what AI wrote" onPress={() => router.push(`${base}/trace`)} trailing={chevron} testID="trace-toggle" />
      <Row icon="user-plus" title="Stay in touch" subtitle="Add squadmates as friends after the event" onPress={() => router.push(`${base}/connect`)} trailing={chevron} />
    </Section>
    <Section flush title={`Members · ${p.members.length}`} testID="squad-members">
      {p.members.map(u => <Row key={u.id} testID={`member-avatar-${u.id}`} leading={<Avatar name={u.name} color={u.avatarColor} />} title={u.id === p.meId ? `${u.name} (you)` : u.name}
        subtitle={[u.checkedIn ? 'Here' : null, u.about, u.sample ? 'Sample person' : null].filter(Boolean).join(' · ') || undefined}
        onPress={u.id === p.meId ? undefined : () => router.push(`${base}/cards?member=${u.id}`)} trailing={u.id === p.meId ? null : chevron} />)}
    </Section>
    {p.canLeave ? <Section flush><LeaveSquad partyId={p.partyId} /></Section> : null}
  </Screen>;
}

/** "Leave squad", like Messenger's "Leave chat": a row that opens a confirm sheet (components/queueup/LeaveSquad.tsx). */
function LeaveSquad({ partyId }: { partyId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const leave = async () => {
    setBusy(true); setError(false);
    const r = await postJSON(`/api/squad/${partyId}/leave`);
    if (r.ok) { setOpen(false); router.replace('/events'); return; }
    setBusy(false); setError(true);
  };
  return <>
    <Row testID="leave-squad" icon="log-out" title="Leave squad" subtitle="Leave the chat and the plan. Nobody is told why." onPress={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title="Leave this squad?" testID="leave-squad-sheet"
      footer={<Button testID="leave-squad-confirm" size="lg" icon="log-out" disabled={busy} onPress={leave}>{error ? 'Try again' : 'Leave squad'}</Button>}>
      <Text style={[t.body, { paddingHorizontal: 16 }]}>You&apos;ll leave the squad and its chat. The others see that you left, not why. You can find a new squad any time.</Text>
      {error ? <Text accessibilityRole="alert" style={[t.meta, { color: c.badge, paddingHorizontal: 16, paddingTop: 8 }]}>Couldn&apos;t leave the squad.</Text> : null}
    </Sheet>
  </>;
}
