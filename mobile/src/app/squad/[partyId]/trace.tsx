import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { stripCitations } from '../../../qu/citations';
import { IconCircle, Loading, Screen, Section, c, t } from '../../../qu/ui';

interface Step { id: string; agent: string; kind: string; summary: string; stepIndex: number; output?: { source?: string } | null }
const AGENT: Record<string, string> = { orchestrator: 'Orchestrator', party_formation: 'Squad matching', event_selection: 'Event pick', hangout_planner: 'Hangout plan', host: 'AI host', talk_cards: 'Talk cards', companion: 'Companions', ratings: 'Past ratings' };

/** "How we matched you": what code checked, and what AI wrote. */
export default function Trace() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data } = useData<Step[]>(`/api/party/${partyId}/trace`, 4000);
  if (!data) return <Screen title="How we matched you" back={`/squad/${partyId}`}><Loading /></Screen>;
  const ai = data.filter(s => s.output?.source), code = data.filter(s => !s.output?.source);
  const List = ({ steps, icon }: { steps: Step[]; icon: 'shield' | 'cpu' }) => <View style={{ gap: 10 }}>
    {steps.map(s => <View key={s.id} style={{ flexDirection: 'row', gap: 10 }}>
      <IconCircle name={icon} size={32} />
      <View style={{ flex: 1 }}><Text style={t.bodyBold}>{AGENT[s.agent] ?? s.agent}</Text><Text style={t.body}>{stripCitations(s.summary)}</Text></View>
    </View>)}
  </View>;
  return <Screen title="How we matched you" back={`/squad/${partyId}`} testID="trace">
    <Section title="What code checked"><List steps={code} icon="shield" /></Section>
    <Section title="What AI wrote"><Text style={[t.meta, { marginBottom: 8 }]}>Muse wrote these. Code checked every pick before it was used.</Text><List steps={ai} icon="cpu" /></Section>
    {data.length === 0 ? <Section><Text style={[t.meta, { color: c.muted }]}>Nothing recorded yet.</Text></Section> : null}
  </Screen>;
}
