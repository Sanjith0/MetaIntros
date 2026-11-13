import React, { useState } from 'react';
import { Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../../qu/hooks';
import { asset, postJSON, sendJSON } from '../../../qu/api';
import { pickPhotos } from '../../../qu/pickPhotos';
import { Avatar, Button, ErrorNote, Icon, Loading, Row, Screen, Section, Sheet, c, t } from '../../../qu/ui';

interface Photo { id: string; url: string; caption: string | null; shareable: boolean; mine: boolean; uploader: { name: string; avatarColor: string; isSimulated: boolean; isLive: boolean } }
interface Data { partyId: string; eventTitle: string; photos: Photo[]; max: number; full: boolean }
const ERRORS: Record<string, string> = {
  bad_image: "That photo couldn't be added. Try a JPEG or PNG.", too_big: 'That photo is too large to add.', album_full: 'This album is full.',
  caption_too_long: 'Captions can be up to 80 characters.', sensitive_caption: "Captions can't mention politics, religion, health or sexuality.",
};
const first = (n: string) => n.split(' ')[0];

/** The squad's shared album (components/album/SquadAlbum.tsx). Only the uploader can change or delete a photo. */
export default function SquadAlbum() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data, error: loadError, reload } = useData<Data>(`/api/squad/${partyId}/album`, 5000);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shareNew, setShareNew] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!data) return <Screen title="Squad album" back={`/squad/${partyId}`}>{loadError ? <ErrorNote error={loadError} onRetry={reload} /> : <Loading />}</Screen>;
  const add = async () => {
    setError(null);
    const room = Math.max(0, data.max - data.photos.length);
    const picked = await pickPhotos();
    const list = picked.slice(0, room);
    if (picked.length > room) setError(room ? `Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'} in this album.` : ERRORS.album_full);
    setBusy(list.length);
    for (const p of list) {
      if (p instanceof Error) setError(ERRORS[p.message] ?? ERRORS.bad_image);
      else {
        const r = await postJSON<{ error?: string }>(`/api/squad/${partyId}/album`, { dataUrl: p, shareable: shareNew });
        if (!r.ok) setError(ERRORS[r.data?.error ?? ''] ?? "That photo couldn't be added.");
      }
      setBusy(n => n - 1);
    }
    reload();
  };
  const open = data.photos.find(p => p.id === openId) ?? null;
  return <Screen title="Squad album" back={`/squad/${partyId}`} testID="squad-album">
    <Section>
      <Text style={t.headline}>Photos from {data.eventTitle}</Text>
      <Text style={[t.body, { color: c.muted, marginTop: 4 }]}>Only your squad can see this album. It stays after the squad chat ends, and you can delete your photos any time.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <View style={{ flex: 1 }}><Text style={t.body}>Squadmates can include my new photos in a post</Text><Text style={t.meta}>On by default. You can change it for each photo.</Text></View>
        <Switch testID="album-share-default" value={shareNew} onValueChange={setShareNew} />
      </View>
      <Button testID="album-add" variant="primary" icon="image" disabled={data.full || busy > 0} onPress={add}>{busy > 0 ? `Adding ${busy} ${busy === 1 ? 'photo' : 'photos'}…` : 'Add photos'}</Button>
      {error ? <Text testID="album-error" accessibilityRole="alert" style={[t.meta, { color: c.badge, marginTop: 8 }]}>{error}</Text> : null}
      {data.full && !error ? <Text style={[t.meta, { marginTop: 8 }]}>This album is full ({data.max} photos).</Text> : null}
    </Section>
    <Section flush title={`${data.photos.length} ${data.photos.length === 1 ? 'photo' : 'photos'}`} style={{ paddingBottom: 0 }}>
      {data.photos.length === 0 ? <Text testID="album-empty" style={[t.body, { color: c.muted, textAlign: 'center', paddingBottom: 24, paddingTop: 8 }]}>No photos yet. Add the first one.</Text>
        : <View testID="album-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {data.photos.map(p => <Pressable key={p.id} testID="album-photo" onPress={() => setOpenId(p.id)} accessibilityLabel={`${p.mine ? 'Your photo' : `${first(p.uploader.name)}'s photo`}${p.caption ? `: ${p.caption}` : ''}`}
            style={{ width: '33%', aspectRatio: 1, backgroundColor: c.control }}>
            <Image source={{ uri: asset(p.url)! }} style={{ width: '100%', height: '100%' }} />
            {!p.shareable ? <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(5,5,5,0.6)', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={12} color={c.surface} /></View> : null}
          </Pressable>)}
        </View>}
    </Section>
    <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.mine ? 'Your photo' : open ? `${first(open.uploader.name)}'s photo` : ''} testID="album-photo-sheet">
      {open ? <PhotoDetail key={open.id} partyId={String(partyId)} photo={open} onChanged={reload} onDeleted={() => { setOpenId(null); reload(); }} /> : null}
    </Sheet>
  </Screen>;
}

function PhotoDetail({ partyId, photo, onChanged, onDeleted }: { partyId: string; photo: Photo; onChanged: () => void; onDeleted: () => void }) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [shareable, setShareable] = useState(photo.shareable);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/squad/${partyId}/album/${photo.id}`;
  const patch = async (body: { shareable?: boolean; caption?: string | null }) => {
    setError(null);
    const r = await sendJSON<{ error?: string }>('PATCH', url, body);
    if (!r.ok) setError(ERRORS[r.data?.error ?? ''] ?? "Couldn't save that.");
    onChanged();
    return r.ok;
  };
  return <View style={{ paddingHorizontal: 16, gap: 12 }}>
    <Image source={{ uri: asset(photo.url)! }} resizeMode="contain" style={{ width: '100%', height: 320, borderRadius: 8, backgroundColor: c.wash }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Avatar name={photo.uploader.name} color={photo.uploader.avatarColor} size={32} />
      <Text style={[t.meta, { flex: 1 }]}>Added by {photo.mine ? 'you' : photo.uploader.name}{!photo.mine && photo.uploader.isSimulated && !photo.uploader.isLive ? ' · Sample person' : ''}</Text>
    </View>
    {photo.mine ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput testID="photo-caption" accessibilityLabel="Caption" value={caption} onChangeText={setCaption} maxLength={80} placeholder="Add a short caption" placeholderTextColor={c.muted}
          style={[t.body, { flex: 1, height: 36, borderRadius: 18, backgroundColor: c.wash, paddingHorizontal: 16 }]} />
        <Button block={false} testID="photo-caption-save" disabled={caption.trim() === (photo.caption ?? '')} onPress={() => patch({ caption: caption.trim() || null })}>Save</Button>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={t.body}>Squadmates can include this in a post</Text><Text style={t.meta}>{shareable ? 'On. Turning it off removes it from their posts too.' : 'Off. Only you can post this photo.'}</Text></View>
        <Switch testID="photo-shareable" value={shareable} onValueChange={async v => { setShareable(v); if (!(await patch({ shareable: v }))) setShareable(!v); }} />
      </View>
      <Button testID="photo-delete" icon="trash-2" onPress={async () => { if (!confirm) return setConfirm(true); const r = await sendJSON('DELETE', url); if (r.ok) onDeleted(); else setError("Couldn't delete that photo."); }}>{confirm ? 'Tap again to delete' : 'Delete photo'}</Button>
    </> : <>
      {photo.caption ? <Text style={t.body}>{photo.caption}</Text> : null}
      <Text style={t.meta}>{photo.shareable ? `${first(photo.uploader.name)} lets squadmates include this in a post.` : `Only ${first(photo.uploader.name)} can post this photo.`}</Text>
    </>}
    {error ? <Text accessibilityRole="alert" style={[t.meta, { color: c.badge }]}>{error}</Text> : null}
  </View>;
}
