import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { getJSON, postJSON } from './api';
import { Avatar, Button, FacePile, Icon, OpenedHeader, Row, Sheet, c, font, t } from './ui';

interface Member { id: string; name: string; avatarColor: string; status: 'joined' | 'invited' }
interface Group { groupId: string; code: string; status: string; isHost: boolean; host: { id: string; name: string; avatarColor: string }; members: Member[] }
interface Invite { groupId: string; host: { name: string; avatarColor: string } }
interface Friend { id: string; name: string; avatarColor: string; status: string | null; eligible: boolean }
interface State { group: Group | null; invites: Invite[]; friends: Friend[] }
export type TogetherRole = { role: 'none' | 'host' | 'member'; joined: number };

const first = (n: string) => n.split(' ')[0];
const ERR: Record<string, string> = {
  not_found: "That code doesn't match a group that's still open.", full: 'That group is full.', unsafe: "You can't queue with this group.",
  age: 'Queue Up is for people 18 and over.', self: "That's your own code.", not_friends: 'You can only invite friends. Share your code instead.',
  already_queued: 'Your group is already in the queue.',
};
const chevron = <Icon name="chevron-right" color={c.muted} />;

/**
 * Queue together, like a party in a game (components/queue/QueueTogether.tsx): invite friends or share a code,
 * then the host taps Find my squad and everyone queues as one. Polls instead of the web app's live stream.
 */
export function QueueTogether({ onRole, onQueued }: { onRole: (r: TogetherRole) => void; onQueued?: () => void }) {
  const [s, setS] = useState<State | null>(null);
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getJSON<State>('/api/groups').then(setS).catch(() => {}), []);
  useEffect(() => { load(); const i = setInterval(load, 3000); return () => clearInterval(i); }, [load]);

  const g = s?.group ?? null;
  const joined = g ? g.members.filter(m => m.status === 'joined') : [];
  const role: TogetherRole['role'] = !g ? 'none' : g.isHost ? 'host' : 'member';
  useEffect(() => { onRole({ role, joined: joined.length }); }, [role, joined.length, onRole]);
  // When the host starts the queue, everyone in the group goes to the queue screen.
  useEffect(() => { if (g && g.status === 'queued') { onQueued?.(); router.push('/queue'); } }, [g, onQueued]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    const r = await postJSON<{ ok?: boolean; error?: string }>('/api/groups', body);
    setBusy(false);
    if (!r.data?.ok) setError(ERR[r.data?.error ?? ''] ?? 'Something went wrong. Try again.');
    await load();
    return !!r.data?.ok;
  };

  if (!s || (!expanded && !g && s.invites.length === 0))
    return <View testID="queue-together"><Row testID="bring-friends" icon="user-plus" title="Bring friends" onPress={() => setExpanded(true)} trailing={chevron} /></View>;

  return <View testID="queue-together" style={{ paddingTop: 8, paddingBottom: 4 }}>
    {g || s.invites.length ? <Text accessibilityRole="header" style={[t.bodyBold, { paddingHorizontal: 16 }]}>Bring friends</Text>
      : <OpenedHeader title="Bring friends" testID="bring-friends-close" onClose={() => { setExpanded(false); setError(null); }} />}
    {s.invites.map(inv => <View key={inv.groupId} testID="group-invite" style={{ marginHorizontal: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.wash, borderRadius: 8, padding: 12 }}>
      <Avatar name={inv.host.name} color={inv.host.avatarColor} size={40} />
      <Text style={[t.meta, { flex: 1, color: c.ink }]}><Text style={{ fontFamily: font.semibold }}>{inv.host.name}</Text> invited you to queue together</Text>
      <Button block={false} variant="on" disabled={busy} testID="group-invite-join" onPress={() => act({ action: 'respond', groupId: inv.groupId, accept: true })}>Join</Button>
      <Button block={false} disabled={busy} testID="group-invite-decline" onPress={() => act({ action: 'respond', groupId: inv.groupId, accept: false })}>Decline</Button>
    </View>)}
    {role === 'member' && g ? <View testID="group-member-card" style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: c.wash, borderRadius: 8, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <FacePile people={joined} size={32} />
        <Text style={[t.body, { flex: 1 }]}>You&apos;re queuing with <Text style={t.bodyBold}>{first(g.host.name)}</Text>{joined.length > 2 ? ` and ${joined.length - 2} more` : ''}</Text>
      </View>
      <Text style={t.meta}>{first(g.host.name)} starts the queue.</Text>
      <Button block={false} disabled={busy} testID="group-leave" onPress={() => act({ action: 'leave' })}>Leave group</Button>
    </View> : <>
      {g && g.members.length > 1 ? <View testID="group-members" style={{ marginTop: 4 }}>
        {g.members.map(m => <Row key={m.id} testID="group-member" leading={<Avatar name={m.name} color={m.avatarColor} size={36} />} title={m.id === g.host.id ? `${m.name} (you)` : m.name} subtitle={m.status === 'joined' ? 'In your group' : 'Invited'} />)}
      </View> : null}
      <Row testID="group-invite-friends" icon="user-plus" title="Invite friends" onPress={() => setPicking(true)} trailing={chevron} />
      {g ? <View testID="group-code-line" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4 }}>
        <Icon name="key" size={16} /><Text style={t.meta}>Or share your code <Text testID="group-code" style={[t.title, { fontFamily: font.bold }]}>{g.code}</Text></Text>
      </View> : <Row testID="group-get-code" icon="key" title="Get a code to share" subtitle="Anyone with the code can join your group" onPress={() => act({ action: 'create' })} trailing={chevron} />}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 }}>
        <TextInput testID="group-code-input" accessibilityLabel="Group code" value={code} onChangeText={v => setCode(v.toUpperCase().slice(0, 6))} placeholder="Have a code?" placeholderTextColor={c.muted} autoCapitalize="characters"
          onSubmitEditing={async () => { if (code.trim().length >= 4 && await act({ action: 'join', code: code.trim() })) setCode(''); }}
          style={[t.body, { flex: 1, height: 36, borderRadius: 18, backgroundColor: c.control, paddingHorizontal: 16 }]} />
        <Button block={false} testID="group-code-join" disabled={busy || code.trim().length < 4} onPress={async () => { if (await act({ action: 'join', code: code.trim() })) setCode(''); }}>Join</Button>
      </View>
    </>}
    {error ? <Text testID="group-error" accessibilityRole="alert" style={[t.meta, { marginHorizontal: 16, marginTop: 8, color: c.badge, fontFamily: font.semibold }]}>{error}</Text> : null}
    <Sheet open={picking} onClose={() => setPicking(false)} title="Invite friends" testID="group-invite-sheet">
      {s.friends.map(f => <Row key={f.id} testID="group-friend" leading={<Avatar name={f.name} color={f.avatarColor} size={40} />} title={f.name}
        subtitle={f.status === 'joined' ? 'In your group' : f.status === 'invited' ? 'Invited' : f.eligible ? undefined : "Can't be in a squad with your group"}
        trailing={f.status ? null : <Button block={false} variant="on" disabled={busy || !f.eligible} testID={`group-invite-${f.id}`} onPress={() => act({ action: 'invite', userId: f.id })}>Invite</Button>} />)}
      {s.friends.length === 0 ? <Text style={[t.meta, { padding: 24 }]}>No friends yet. Share your code instead.</Text> : null}
    </Sheet>
  </View>;
}
