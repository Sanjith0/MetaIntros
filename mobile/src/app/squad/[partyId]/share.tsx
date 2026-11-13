import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { postJSON } from '../../../qu/api';
import { Composer, type ShareablePhoto } from '../../../qu/feed';
import { AiLabel, Button, ErrorNote, Icon, IconCircle, Loading, Row, Screen, Section, c, t } from '../../../qu/ui';

interface ShareState { partyId: string; eventTitle: string; open: boolean; choice: string | null; photos: ShareablePhoto[] }
type Step = { s: 'choose' } | { s: 'own' } | { s: 'thinking' } | { s: 'draft'; photoIds: string[]; caption: string; source: string } | { s: 'posted'; kind: 'post' | 'story' } | { s: 'declined' };
const chevron = <Icon name="chevron-right" color={c.muted} />;

/** "Share the outing" after the event (components/posts/ShareOuting.tsx): your own post, an AI-suggested one, or none. */
export default function ShareOuting() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const id = String(partyId);
  const { data: state, error: loadError, reload } = useData<ShareState>(`/api/squad/${id}/share`);
  const [step, setStep] = useState<Step>({ s: 'choose' });
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  if (!state) return <Screen title="Share the outing" back={`/squad/${id}`}>{loadError ? <ErrorNote error={loadError} onRetry={reload} /> : <Loading />}</Screen>;
  const album = { partyId: id, eventTitle: state.eventTitle, photos: state.photos };
  const already = choice ?? state.choice;
  const suggest = async () => {
    setError(null); setStep({ s: 'thinking' });
    const r = await postJSON<{ draft?: { photoIds: string[]; caption: string; source: string } }>(`/api/squad/${id}/share/suggest`);
    if (!r.ok || !r.data?.draft) { setStep({ s: 'choose' }); return setError("Couldn't get a suggestion right now. Try again or make your own post."); }
    await reload();
    setStep({ s: 'draft', ...r.data.draft });
  };
  const decline = async () => {
    setError(null);
    const r = await postJSON(`/api/squad/${id}/share`, { choice: 'none' });
    if (!r.ok) return setError("Couldn't save that. Try again.");
    setChoice('none'); setStep({ s: 'declined' });
  };
  return <Screen title="Share the outing" back={`/squad/${id}`} testID="share-outing">
    {!state.open ? <Section>
      <Text style={t.headline}>After {state.eventTitle}</Text>
      <Text style={[t.body, { color: c.muted, marginVertical: 8 }]}>Sharing opens once the event is over. Until then, add photos to your squad album.</Text>
      <Button variant="primary" icon="image" onPress={() => router.push(`/squad/${id}/album`)}>Open squad album</Button>
    </Section> : step.s === 'choose' ? <>
      <Section>
        <Text style={t.headline}>How do you want to share {state.eventTitle}?</Text>
        <Text style={[t.body, { color: c.muted, marginTop: 4 }]}>It&apos;s up to you. Your squadmates choose for themselves, and nobody is told what you pick.</Text>
        {already ? <Text testID="share-already" style={[t.meta, { backgroundColor: c.wash, borderRadius: 8, padding: 12, marginTop: 8 }]}>{already === 'none' ? 'You chose not to post. You can still share something.' : 'You already shared a post. You can share another.'}</Text> : null}
      </Section>
      <Section flush>
        <Row testID="share-own" icon="image" title="Make my own post" subtitle="Pick photos from the squad album and write a caption" onPress={() => setStep({ s: 'own' })} trailing={chevron} />
        <Row testID="share-ai" icon="star" title="Let AI suggest a post" subtitle="The AI host picks up to 4 photos and drafts a caption. You review it first." onPress={suggest} trailing={chevron} />
        <Row testID="share-none" icon="x" title="Don't post" subtitle="We won't ask again" onPress={decline} />
        {error ? <Text accessibilityRole="alert" style={[t.meta, { color: c.badge, paddingHorizontal: 16, paddingBottom: 8 }]}>{error}</Text> : null}
      </Section>
      <Section flush><Row icon="image" title="Squad album" subtitle={`${state.photos.length} ${state.photos.length === 1 ? 'photo' : 'photos'} you can use`} onPress={() => router.push(`/squad/${id}/album`)} trailing={chevron} /></Section>
    </> : step.s === 'thinking' ? <Section testID="share-thinking">
      <AiLabel>The AI host is drafting a post</AiLabel>
      <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
    </Section> : step.s === 'own' || step.s === 'draft' ? <Section>
      <Text style={[t.headline, { marginBottom: 12 }]}>{step.s === 'draft' ? 'Suggested post' : 'Your post'}</Text>
      <Composer key={step.s} albums={[album]} initialPartyId={id} bindParty
        initial={step.s === 'draft' ? { photoIds: step.photoIds, caption: step.caption } : undefined}
        ai={step.s === 'draft' ? { source: step.source, caption: step.caption } : null}
        onPosted={r => { setChoice(step.s === 'draft' ? 'ai' : 'own'); setStep({ s: 'posted', kind: r.kind }); }}
        onCancel={() => setStep({ s: 'choose' })} cancelLabel={step.s === 'draft' ? 'Discard' : 'Cancel'} />
    </Section> : step.s === 'posted' ? <Section testID="share-done">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.positive, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" color={c.surface} /></View>
        <View><Text style={t.bodyBold}>{step.kind === 'story' ? 'Added to your story' : 'Posted'}</Text><Text style={t.meta}>{step.kind === 'story' ? 'Your story disappears in 24 hours.' : "It's on Home now."}</Text></View>
      </View>
      <View style={{ height: 12 }} />
      <Button testID="share-see-home" variant="primary" onPress={() => router.push('/home')}>See it on Home</Button>
      <Pressable onPress={() => router.push(`/squad/${id}`)} style={{ marginTop: 12 }}><Text style={[t.body, { color: c.link, textAlign: 'center' }]}>Back to squad info</Text></Pressable>
    </Section> : <Section testID="share-declined">
      <Text style={t.bodyBold}>Got it. You won&apos;t be asked again.</Text>
      <Text style={[t.meta, { marginTop: 4 }]}>The squad album stays here if you change your mind.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <View style={{ flex: 1 }}><Button onPress={() => router.push(`/squad/${id}`)}>Back to squad info</Button></View>
        <View style={{ flex: 1 }}><Button onPress={() => router.push(`/squad/${id}/album`)}>Squad album</Button></View>
      </View>
    </Section>}
  </Screen>;
}
