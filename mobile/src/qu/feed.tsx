import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { asset, postJSON, sendJSON } from './api';
import { Chip } from './QueueSetup';
import { AiLabel, AiSourceLabel, Avatar, Button, Icon, Sheet, c, font, t, type IconName } from './ui';

/** The feed post shell (components/feed/Post.tsx). Like, Comment and Share are inert in this prototype. */
export function Post({ who, color, avatarUrl, ago, text, likes, comments, audience = 'public', place, label, menu, children, testID = 'post' }: {
  who: string; color?: string; avatarUrl?: string | null; ago: string; text?: string; likes?: number; comments?: number;
  audience?: 'public' | 'friends' | 'only_me'; place?: React.ReactNode; label?: React.ReactNode; menu?: React.ReactNode; children?: React.ReactNode; testID?: string;
}) {
  const aud: IconName = audience === 'public' ? 'globe' : audience === 'friends' ? 'users' : 'lock';
  return <View testID={testID} style={{ backgroundColor: c.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
      <Avatar name={who} color={color} photoUrl={avatarUrl} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {place ? <Text style={t.body}><Text style={t.bodyBold}>{who}</Text> {place}</Text> : <Text numberOfLines={1} style={t.bodyBold}>{who}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={t.meta}>{ago} ·</Text><Icon name={aud} size={12} color={c.muted} /></View>
      </View>
      {menu ?? <Icon name="more-horizontal" color={c.muted} />}
    </View>
    {text ? <Text style={[t.body, { paddingHorizontal: 16, paddingVertical: 8 }]}>{text}</Text> : null}
    {label ? <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>{label}</View> : null}
    {!text && !label ? <View style={{ height: 8 }} /> : null}
    {children}
    {likes !== undefined ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="thumbs-up" size={10} color={c.surface} /></View>
        <Text style={t.meta}>{likes}</Text>
      </View>
      <Text style={t.meta}>{comments ?? 0} comments</Text>
    </View> : null}
    <View style={{ flexDirection: 'row', marginHorizontal: 16, borderTopWidth: 1, borderTopColor: '#e4e6eb' }}>
      {([['thumbs-up', 'Like'], ['message-circle', 'Comment'], ['share-2', 'Share']] as const).map(([i, l]) =>
        <View key={l} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
          <Icon name={i} size={18} color={c.muted} /><Text style={[t.body, { fontFamily: font.semibold, color: c.muted }]}>{l}</Text>
        </View>)}
    </View>
  </View>;
}

/** Feed photo layouts: 1 full width, 2 side by side, 3 = one wide and two, 4+ = 2x2 with "+N". */
export function PhotoGrid({ photos }: { photos: { id: string; url: string }[] }) {
  if (!photos.length) return null;
  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const img = (p: { id: string; url: string }, i: number, style: object) => <View key={p.id} style={[{ backgroundColor: c.control, overflow: 'hidden' }, style]}>
    <Image testID="post-photo" source={{ uri: asset(p.url)! }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    {extra > 0 && i === 3 ? <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5,5,5,0.5)', alignItems: 'center', justifyContent: 'center' } as object}><Text style={[t.page, { color: c.surface }]}>+{extra}</Text></View> : null}
  </View>;
  if (shown.length === 1) return img(shown[0], 0, { width: '100%', aspectRatio: 4 / 3 });
  const half = { width: '49.8%', aspectRatio: 1 };
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
    {shown.map((p, i) => img(p, i, shown.length === 3 && i === 0 ? { width: '100%', aspectRatio: 2 } : half))}
  </View>;
}

/** Who wrote a posted caption (components/posts/CaptionSource.tsx). */
export function CaptionSource({ source, edited }: { source: string | null; edited?: boolean }) {
  if (!source) return null;
  const ai = source === 'live' || source === 'cache' || source === 'mixed';
  const words = ai ? 'Caption written by AI' : source === 'mock' ? 'Caption by the test model' : 'Caption from a template (AI unavailable)';
  return <AiLabel testID="caption-source">{edited ? `${words}, edited by the author` : words}</AiLabel>;
}

/** "..." on your own post or story: delete it. */
export function OwnPostMenu({ postId, kind, onDone }: { postId: string; kind: 'post' | 'story'; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <>
    <Pressable testID="own-post-menu" accessibilityLabel={`Options for your ${kind}`} onPress={() => setOpen(true)} style={{ padding: 6 }}><Icon name="more-horizontal" color={c.muted} /></Pressable>
    <Sheet open={open} onClose={() => setOpen(false)} title={kind === 'story' ? 'Your story' : 'Your post'}>
      <View style={{ paddingHorizontal: 16 }}>
        <Button testID="delete-post" icon="trash-2" disabled={busy} onPress={async () => { setBusy(true); await sendJSON('DELETE', `/api/posts/${postId}`); setBusy(false); setOpen(false); onDone(); }}>{`Delete ${kind}`}</Button>
      </View>
    </Sheet>
  </>;
}

export interface PostView {
  id: string; kind: 'post' | 'story'; mine: boolean; author: { id: string; name: string; avatarColor: string; isSimulated: boolean; isLive: boolean };
  caption: string; audience: 'friends' | 'only_me'; createdAt: string; event: { id: string; title: string } | null; aiSource: string | null; aiEdited: boolean; photos: { id: string; url: string }[];
}
/** A real post on Home: your own or a friend's. */
export function RealPost({ post, ago, onChanged }: { post: PostView; ago: string; onChanged: () => void }) {
  const sample = !post.mine && post.author.isSimulated && !post.author.isLive;
  return <Post testID="real-post" who={post.author.name} color={post.author.avatarColor} ago={sample ? `${ago} · Sample person` : ago} text={post.caption} audience={post.audience}
    place={post.event ? <>is at <Text style={t.bodyBold}>{post.event.title}</Text> with their Queue Up squad.</> : undefined}
    label={post.aiSource ? <CaptionSource source={post.aiSource} edited={post.aiEdited} /> : undefined}
    menu={post.mine ? <OwnPostMenu postId={post.id} kind="post" onDone={onChanged} /> : undefined}>
    <PhotoGrid photos={post.photos} />
  </Post>;
}

export interface ShareablePhoto { id: string; url: string; mine: boolean; uploaderName: string }
export interface ComposerAlbum { partyId: string; eventTitle: string; photos: ShareablePhoto[] }
const ERRORS: Record<string, string> = {
  empty: 'Add a photo or write something.', photo_not_allowed: "One of those photos isn't available any more. Pick again.",
  caption_too_long: "That's too long. Keep it under 500 characters.", not_found: "You can't post from that album.",
};
const firstName = (n: string) => n.split(' ')[0];

/** Write a post or story from a squad album, or text only (components/posts/PostComposer.tsx). The server rechecks every rule. */
export function Composer({ albums, initialPartyId, bindParty = false, initial, initialKind = 'post', ai, onPosted, onCancel, cancelLabel = 'Cancel', testID = 'post-composer' }: {
  albums: ComposerAlbum[]; initialPartyId?: string | null; bindParty?: boolean; initial?: { photoIds: string[]; caption: string }; initialKind?: 'post' | 'story';
  ai?: { source: string; caption: string } | null; onPosted: (r: { id: string; kind: 'post' | 'story' }) => void; onCancel?: () => void; cancelLabel?: string; testID?: string;
}) {
  const [partyId, setPartyId] = useState<string | null>(initialPartyId ?? albums[0]?.partyId ?? null);
  const album = albums.find(a => a.partyId === partyId) ?? null;
  const [selected, setSelected] = useState<string[]>(() => (initial?.photoIds ?? []).filter(id => album?.photos.some(p => p.id === id)));
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [kind, setKind] = useState(initialKind);
  const [audience, setAudience] = useState<'friends' | 'only_me'>('friends');
  const [picker, setPicker] = useState(!ai);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map((album?.photos ?? []).map(p => [p.id, p]));
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 10 ? s : [...s, id]);
  const edited = ai ? caption.trim() !== ai.caption.trim() : false;
  const empty = !caption.trim() && !selected.length;
  const share = async () => {
    setBusy(true); setError(null);
    const r = await postJSON<{ id: string; error?: string }>('/api/posts', { kind, audience, caption, partyId: selected.length || bindParty ? partyId : null, photoIds: selected, ai: ai ?? null });
    setBusy(false);
    if (!r.ok || !r.data) return setError(ERRORS[r.data?.error ?? ''] ?? "Couldn't post that. Try again.");
    onPosted({ id: r.data.id, kind });
  };
  return <View testID={testID} style={{ gap: 12 }}>
    {ai ? <View style={{ backgroundColor: c.wash, borderRadius: 8, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><AiSourceLabel source={ai.source} />{edited ? <Text testID="composer-edited" style={t.meta}>· Edited by you</Text> : null}</View>
      <Text style={t.meta}>{ai.source === 'fallback' ? "AI wasn't available, so this is a simple template. Nothing is posted until you tap Share." : 'The AI host saw who took each photo and when, never the photos themselves. Nothing is posted until you tap Share.'}</Text>
    </View> : null}
    {selected.length ? <ScrollView horizontal testID="composer-selected" contentContainerStyle={{ gap: 8 }}>
      {selected.map(id => { const p = byId.get(id); return p ? <View key={id} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: c.control }}>
        <Image source={{ uri: asset(p.url)! }} style={{ width: 80, height: 80 }} />
        <Pressable testID="composer-remove-photo" accessibilityLabel="Remove photo" onPress={() => toggle(id)} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(5,5,5,0.6)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} color={c.surface} /></Pressable>
      </View> : null; })}
    </ScrollView> : null}
    <TextInput testID="composer-caption" accessibilityLabel="Caption" value={caption} onChangeText={setCaption} maxLength={500} multiline numberOfLines={3}
      placeholder={kind === 'story' ? 'Add text to your story' : album ? `Say something about ${album.eventTitle}` : "What's on your mind?"} placeholderTextColor={c.muted}
      style={[t.body, { backgroundColor: c.wash, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 72, textAlignVertical: 'top' }]} />
    {albums.length ? (!picker ? <Button block={false} testID="composer-show-picker" onPress={() => setPicker(true)}>Choose different photos</Button> : <View>
      <Text style={t.bodyBold}>Photos from your squad album</Text>
      {albums.length > 1 ? <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingTop: 8 }}>{albums.map(a => <Chip key={a.partyId} on={a.partyId === partyId} onPress={() => { setPartyId(a.partyId); setSelected([]); }}>{a.eventTitle}</Chip>)}</ScrollView> : null}
      {album && album.photos.length ? <View testID="composer-photos" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {album.photos.map(p => { const n = selected.indexOf(p.id); return <Pressable key={p.id} testID="composer-photo" onPress={() => toggle(p.id)} accessibilityState={{ selected: n >= 0 }}
          accessibilityLabel={p.mine ? 'Your photo' : `${firstName(p.uploaderName)}'s photo`}
          style={{ width: '23.5%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: c.control, borderWidth: n >= 0 ? 2 : 0, borderColor: c.accent }}>
          <Image source={{ uri: asset(p.url)! }} style={{ width: '100%', height: '100%' }} />
          {n >= 0 ? <View style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.surface, fontFamily: font.semibold, fontSize: 12 }}>{n + 1}</Text></View> : null}
          {!p.mine ? <Text numberOfLines={1} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,5,0.5)', color: c.surface, fontSize: 11, paddingHorizontal: 4 }}>{firstName(p.uploaderName)}</Text> : null}
        </Pressable>; })}
      </View> : <Text style={[t.meta, { marginTop: 4 }]}>No photos you can use yet.</Text>}
      <Text style={[t.meta, { marginTop: 8 }]}>Squadmates&apos; photos show here only if they allowed them in posts.</Text>
    </View>) : null}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Chip testID="composer-kind-post" on={kind === 'post'} onPress={() => setKind('post')}>Post</Chip>
      <Chip testID="composer-kind-story" on={kind === 'story'} onPress={() => setKind('story')}>Story</Chip>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Chip testID="composer-audience-friends" icon="users" on={audience === 'friends'} onPress={() => setAudience('friends')}>Friends</Chip>
      <Chip testID="composer-audience-only-me" icon="lock" on={audience === 'only_me'} onPress={() => setAudience('only_me')}>Only me</Chip>
    </View>
    <Text style={t.meta}>{kind === 'story' ? 'Stories disappear after 24 hours.' : 'You can delete your post later.'} {audience === 'friends' ? 'Your friends can see it.' : 'Only you can see it.'}</Text>
    {error ? <Text testID="composer-error" accessibilityRole="alert" style={[t.meta, { color: c.badge }]}>{error}</Text> : null}
    <Button testID="composer-share" variant="primary" size="lg" disabled={busy || empty} onPress={share}>{busy ? 'Sharing…' : kind === 'story' ? 'Share to story' : 'Share'}</Button>
    {onCancel ? <Button testID="composer-cancel" onPress={onCancel}>{cancelLabel}</Button> : null}
  </View>;
}

export interface StoryItem { id: string; caption: string; photos: { id: string; url: string }[]; ago: string; event: { title: string } | null; audience: 'friends' | 'only_me'; aiSource: string | null; aiEdited: boolean }
export interface StoryGroup { author: { id: string; name: string; avatarColor: string; isSimulated: boolean; isLive: boolean }; mine: boolean; stories: StoryItem[] }
type Frame = { story: StoryItem; photo: { id: string; url: string } | null };
const framesOf = (g: StoryGroup): Frame[] => g.stories.flatMap((s): Frame[] => s.photos.length ? s.photos.map(photo => ({ story: s, photo })) : [{ story: s, photo: null }]);

/** Full-screen story viewer: tap the right side to advance, the left third to go back, X to close. */
export function StoryViewer({ groups, startGroup, onClose }: { groups: StoryGroup[]; startGroup: number; onClose: () => void }) {
  const [gi, setGi] = useState(startGroup);
  const [fi, setFi] = useState(0);
  const g = groups[gi];
  const frames = g ? framesOf(g) : [];
  const f = frames[Math.min(fi, frames.length - 1)];
  const next = () => { if (fi < frames.length - 1) setFi(fi + 1); else if (gi < groups.length - 1) { setGi(gi + 1); setFi(0); } else onClose(); };
  const prev = () => { if (fi > 0) setFi(fi - 1); else if (gi > 0) { setFi(framesOf(groups[gi - 1]).length - 1); setGi(gi - 1); } };
  if (!g || !f) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View testID="story-viewer" style={{ flex: 1, backgroundColor: '#000', maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 8 }}>
        {frames.map((_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= fi ? '#fff' : 'rgba(255,255,255,0.35)' }} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
        <Avatar name={g.author.name} color={g.author.avatarColor} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[t.bodyBold, { color: '#fff' }]}>{g.mine ? 'Your story' : g.author.name}</Text>
          <Text style={[t.meta, { color: 'rgba(255,255,255,0.8)' }]}>{f.story.ago}{f.story.event ? ` · ${f.story.event.title}` : ''}{f.story.audience === 'only_me' ? ' · Only me' : ''}</Text>
        </View>
        <Pressable testID="story-close" accessibilityLabel="Close" onPress={onClose} style={{ padding: 8 }}><Icon name="x" color="#fff" size={24} /></Pressable>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {f.photo ? <Image source={{ uri: asset(f.photo.url)! }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
          : <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 24, textAlign: 'center', padding: 24 }}>{f.story.caption}</Text>}
        <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' } as object}>
          <Pressable accessibilityLabel="Previous" onPress={prev} style={{ width: '33%' }} />
          <Pressable testID="story-next" accessibilityLabel="Next" onPress={next} style={{ flex: 1 }} />
        </View>
      </View>
      {f.photo && f.story.caption ? <View style={{ padding: 16, gap: 4 }}>
        <Text style={[t.body, { color: '#fff' }]}>{f.story.caption}</Text>
        {f.story.aiSource ? <CaptionSource source={f.story.aiSource} edited={f.story.aiEdited} /> : null}
      </View> : null}
    </View>
  </Modal>;
}
