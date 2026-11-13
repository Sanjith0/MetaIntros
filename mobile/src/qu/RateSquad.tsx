import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { postJSON } from './api';
import { Chip } from './QueueSetup';
import { Avatar, Button, Icon, Row, Sheet, c, t } from './ui';

type Verdict = 'again' | 'not_again';
export interface RatingState {
  partyId: string; eventTitle: string; ended: boolean; askNow: boolean;
  mates: { id: string; name: string; avatarColor: string; sample?: boolean }[];
  mine: { stars: number | null; mates: Record<string, Verdict> } | null;
}
const WORDS = ['', 'Not great', 'It was OK', 'Good', 'Really good', 'Loved it'];
const first = (n: string) => n.split(' ')[0];

/**
 * After the squad chat ends: "How was the night?" (1 to 5) and, per squadmate, "Squad up again?" (components/chat/RateSquadSheet.tsx).
 * Private: only Link reads the answers, to tune your next squads and event picks.
 */
export function RateSquadSheet({ open, state, onClose, onSaved }: { open: boolean; state: RatingState; onClose: (skipped: boolean) => void; onSaved: (s: RatingState) => void }) {
  const [stars, setStars] = useState(state.mine?.stars ?? 0);
  const [mates, setMates] = useState<Record<string, Verdict>>(state.mine?.mates ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const toggle = (id: string, v: Verdict) => setMates(m => { const n = { ...m }; if (n[id] === v) delete n[id]; else n[id] = v; return n; });
  const save = async () => {
    if (!stars || saving) return;
    setSaving(true); setError(false);
    const r = await postJSON(`/api/squad/${state.partyId}/rating`, { stars, mates });
    setSaving(false);
    if (!r.ok) return setError(true);
    onSaved({ ...state, mine: { stars, mates }, askNow: false });
  };
  return <Sheet open={open} onClose={() => onClose(!state.mine)} title="How was the night?" testID="rate-sheet" footer={<View style={{ gap: 8 }}>
    {error ? <Text style={[t.meta, { color: c.badge, textAlign: 'center' }]}>Couldn&apos;t save. Try again.</Text> : null}
    <Button testID="rate-submit" variant="primary" size="lg" disabled={!stars || saving} onPress={save}>{saving ? 'Saving…' : 'Done'}</Button>
    {!state.mine ? <Pressable testID="rate-skip" onPress={() => onClose(true)} style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}><Text style={[t.body, { color: c.muted }]}>Not now</Text></Pressable> : null}
  </View>}>
    <View style={{ paddingHorizontal: 16 }}>
      <Text style={[t.body, { color: c.muted }]}>{state.eventTitle}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Rate the night" style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 12 }}>
        {[1, 2, 3, 4, 5].map(n => <Pressable key={n} testID={`rate-star-${n}`} accessibilityRole="radio" accessibilityState={{ checked: stars === n }} accessibilityLabel={`${n} star${n === 1 ? '' : 's'}: ${WORDS[n]}`}
          onPress={() => setStars(n)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, lineHeight: 36, color: n <= stars ? c.accent : c.disabled }}>{n <= stars ? '★' : '☆'}</Text>
        </Pressable>)}
      </View>
      <Text testID="rate-star-word" style={[t.meta, { textAlign: 'center', height: 20, marginTop: 4 }]}>{WORDS[stars]}</Text>
    </View>
    {state.mates.length ? <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#e4e6eb', paddingTop: 12 }}>
      <Text style={[t.title, { paddingHorizontal: 16 }]}>Squad up with them again?</Text>
      <Text style={[t.meta, { paddingHorizontal: 16 }]}>Optional. Skip anyone you like.</Text>
      {state.mates.map(m => { const v = mates[m.id]; return <Row key={m.id} testID={`rate-mate-${m.id}`} leading={<Avatar name={m.name} color={m.avatarColor} size={40} />} title={first(m.name)} subtitle={m.sample ? 'Sample person' : undefined}
        trailing={<View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip testID={`rate-again-${m.id}`} icon="thumbs-up" on={v === 'again'} onPress={() => toggle(m.id, 'again')}>Yes</Chip>
          <Chip testID={`rate-not-again-${m.id}`} icon="thumbs-down" on={v === 'not_again'} onPress={() => toggle(m.id, 'not_again')}>No</Chip>
        </View>} />; })}
    </View> : null}
    <View testID="rate-privacy" style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: c.wash, borderRadius: 8, padding: 12 }}>
      <Icon name="lock" size={14} color={c.muted} />
      <Text style={[t.meta, { flex: 1 }]}>Only Link sees your answers. Nobody is told how you rated them. We use them to pick your next squads and events, and we won&apos;t match you with anyone you said no to.</Text>
    </View>
  </Sheet>;
}
