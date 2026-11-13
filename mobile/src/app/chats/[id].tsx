import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getJSON, postJSON } from '../../qu/api';
import { Avatar, FacePile, Icon, Loading, TopBar, c, font, t } from '../../qu/ui';
import { first, fmtDuration, fmtEventWhen } from '../../qu/format';

interface U { id: string; name: string; avatarColor: string; isSimulated?: boolean; isLive?: boolean }
interface Msg { id: string; body: string; kind: string; createdAt: string; senderId: string | null; sender: U | null; failed?: boolean; aiSource?: string | null }
interface ChatData {
  meId: string;
  chat: { id: string; type: string; title: string | null; archived: boolean; partyId: string | null; members: { user: U }[]; messages: Msg[] };
  squad: { partyId: string; expiresAt: string | null; archived?: boolean; meetingSpot: string; event: { title: string; startsAt: string } } | null;
}
const isSample = (u: U | null | undefined) => Boolean(u?.isSimulated && !u.isLive);

function Bubble({ mine, children, dim }: { mine: boolean; children: string; dim?: boolean }) {
  return <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? c.accent : c.bubbleIn, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, opacity: dim ? 0.6 : 1 }}>
    <Text style={[t.body, { color: mine ? c.surface : c.ink }]}>{children}</Text>
  </View>;
}

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [archived, setArchived] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);

  useEffect(() => {
    getJSON<ChatData>(`/api/m/chats/${id}`).then(d => { setData(d); setMessages(d.chat.messages); setArchived(d.chat.archived || Boolean(d.squad?.archived)); }).catch(() => {});
  }, [id]);
  const poll = useCallback(async () => {
    const j = await getJSON<{ archived: boolean; messages: Msg[] }>(`/api/chats/${id}/messages`).catch(() => null);
    if (!j) return;
    if (j.archived) setArchived(true);
    setMessages(ms => {
      const seen = new Set(ms.map(m => m.id));
      const fresh = j.messages.filter(m => !seen.has(m.id));
      if (fresh.length) postJSON(`/api/chats/${id}/read`);
      return fresh.length ? [...ms.filter(m => !m.failed || true), ...fresh] : ms;
    });
  }, [id]);
  useFocusEffect(useCallback(() => { const timer = setInterval(poll, 2000); return () => clearInterval(timer); }, [poll]));

  if (!data) return <View style={{ flex: 1, backgroundColor: c.surface }}><TopBar title="Chat" back="/chats" /><Loading /></View>;
  const { chat, squad, meId } = data;
  const others = chat.members.map(m => m.user).filter(u => u.id !== meId);
  const title = chat.type === 'direct' ? others[0]?.name ?? 'Chat' : chat.title ?? 'Chat';
  const isSquad = chat.type === 'squad' && Boolean(squad);
  const expiry = squad?.expiresAt ? (archived ? 'Chat ended' : `Ends in ${fmtDuration(new Date(squad.expiresAt).getTime() - Date.now())}`) : null;

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || sending) return;
    setSending(true); setDraft('');
    const r = await postJSON<{ ok: boolean; message: Msg }>(`/api/chats/${chat.id}/messages`, { body });
    setSending(false);
    if (r.status === 409) { setArchived(true); return; }
    if (r.data?.ok) {
      const me = chat.members.find(m => m.user.id === meId)?.user ?? null;
      setMessages(ms => (ms.some(m => m.id === r.data!.message.id) ? ms : [...ms, { ...r.data!.message, sender: me }]));
    } else setMessages(ms => [...ms, { id: `failed-${Date.now()}`, body, kind: 'user', createdAt: new Date().toISOString(), senderId: meId, sender: null, failed: true }]);
  };
  const who = (m: Msg) => (m.kind === 'host' ? 'host' : m.kind === 'system' ? null : m.senderId);

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.surface }} testID="chat-thread">
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.control }}>
      <Pressable accessibilityLabel="Back to chats" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevron-left" size={28} color={c.accent} />
      </Pressable>
      {chat.type === 'direct' && others[0] ? <Avatar name={others[0].name} color={others[0].avatarColor} size={36} /> : <FacePile people={others.slice(0, 2)} size={28} max={2} />}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={t.bodyBold}>{title}</Text>
        <Text numberOfLines={1} style={t.meta}>{chat.type === 'direct' ? 'Messenger' : `${chat.members.length} members`}{expiry ? ` · ${expiry}` : ''}</Text>
      </View>
    </View>
    {isSquad && squad ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.control }}>
      <Icon name="map-pin" size={16} color={c.muted} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[t.meta, { color: c.ink, fontFamily: font.semibold }]}>{squad.event.title}</Text>
        <Text numberOfLines={1} style={t.meta}>{fmtEventWhen(squad.event.startsAt)} · Meet: {squad.meetingSpot}</Text>
      </View>
    </View> : null}
    <ScrollView ref={scroll as never} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }} testID="messages">
      {messages.map((m, i) => {
        if (m.kind === 'system') return <Text key={m.id} style={[t.meta, { textAlign: 'center', marginVertical: 8 }]}>{m.body}</Text>;
        const startsRun = i === 0 || who(messages[i - 1]) !== who(m);
        const endsRun = i === messages.length - 1 || who(messages[i + 1]) !== who(m);
        if (m.kind === 'host') return <View key={m.id} testID="msg-host" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: startsRun ? 8 : 2 }}>
          <View style={{ width: 28 }}>{endsRun ? <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center' }}><Icon name="cpu" size={15} /></View> : null}</View>
          <View style={{ maxWidth: '75%' }}>
            {startsRun ? <Text style={{ fontSize: 12, color: c.muted, marginLeft: 12, marginBottom: 2, fontFamily: font.body }}>Queue Up host · AI</Text> : null}
            <Bubble mine={false}>{m.body}</Bubble>
          </View>
        </View>;
        const mine = m.senderId === meId;
        return <View key={m.id} testID="msg-user" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: startsRun ? 8 : 2 }}>
          {!mine ? <View style={{ width: 28 }}>{endsRun && m.sender ? <Avatar name={m.sender.name} color={m.sender.avatarColor} size={28} /> : null}</View> : null}
          <View style={{ maxWidth: '75%' }}>
            {!mine && startsRun && chat.type !== 'direct' && m.sender ? <Text style={{ fontSize: 12, color: c.muted, marginLeft: 12, marginBottom: 2, fontFamily: font.body }}>{first(m.sender.name)}{isSquad && isSample(m.sender) ? ' · Sample person' : ''}</Text> : null}
            <Bubble mine={mine} dim={m.failed}>{m.body}</Bubble>
            {m.failed ? <Text onPress={() => { setMessages(ms => ms.filter(x => x.id !== m.id)); send(m.body); }} style={{ fontSize: 12, color: c.badge, textAlign: 'right', fontFamily: font.semibold }}>Not sent · Try again</Text> : null}
          </View>
        </View>;
      })}
    </ScrollView>
    {archived ? <View style={{ borderTopWidth: 1, borderTopColor: c.divider, padding: 12 }}>
      <Text style={[t.meta, { textAlign: 'center' }]}>This squad chat has ended. You can still read it.</Text>
    </View> : <View>
      {isSquad ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
        <Pressable testID="ask-host" onPress={() => setDraft(d => (d.startsWith('@host') ? d : `@host ${d}`))} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.control, justifyContent: 'center' }}><Text style={[t.meta, { color: c.ink, fontFamily: font.semibold }]}>Ask the host</Text></Pressable>
      </ScrollView> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => send()} placeholder="Aa" placeholderTextColor={c.muted} returnKeyType="send" blurOnSubmit={false}
          style={[t.body, { flex: 1, backgroundColor: c.wash, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }]} testID="composer" />
        <Pressable accessibilityLabel="Send" disabled={sending || !draft.trim()} onPress={() => send()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: draft.trim() ? 1 : 0.4 }}>
          <Icon name="send" size={22} color={c.accent} />
        </Pressable>
      </View>
    </View>}
  </KeyboardAvoidingView>;
}
