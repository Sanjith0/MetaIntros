import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '../qu/hooks';
import { asset } from '../qu/api';
import { Composer, Post, RealPost, StoryViewer, type ComposerAlbum, type PostView, type StoryGroup } from '../qu/feed';
import { Avatar, Cover, DateLine, ErrorNote, FacePile, Icon, Loading, Screen, Sheet, c, font, t, toast } from '../qu/ui';

type MockPost = { kind: 'mock'; id: string; who: string; color: string; avatar: string; ago: string; text: string; photo?: string; likes: number; comments: number;
  event: { id: string; title: string; startsAt: string; venueName: string; coverColor: string; cover: string | null } | null };
type RealRow = Omit<PostView, 'kind'> & { kind: 'real'; ago: string };
interface HomeData {
  me: { name: string; avatarColor: string };
  friendQueues: { count: number; first: { friend: { name: string }; label: string } | null; faces: { id: string; name: string; avatarColor: string }[] };
  posts: (MockPost | RealRow)[]; stories: StoryGroup[]; mockStories: { id: string; name: string; color: string; photo?: string }[]; albums: ComposerAlbum[];
}

/** Home (app/(app)/home/page.tsx): composer, stories rail, friends queuing, your and friends' posts, then the seeded feed. */
export default function HomeScreen() {
  const { data, error, reload } = useData<HomeData>('/api/m/home');
  const params = useLocalSearchParams<{ compose?: string }>();
  const [compose, setCompose] = useState<null | 'post' | 'story'>(null);
  const [opens, setOpens] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const open = (k: 'post' | 'story') => { setOpens(n => n + 1); setCompose(k); };
  useEffect(() => { if (params.compose) { open('post'); router.setParams({ compose: undefined }); } }, [params.compose]);
  return <Screen title="Queue Up" variant="home" testID="home-page">
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : <>
      <View style={{ gap: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Avatar name={data.me.name} color={data.me.avatarColor} size={40} />
          <Pressable testID="home-compose" onPress={() => open('post')} style={{ flex: 1, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.divider, justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text style={[t.body, { color: c.muted }]}>What&apos;s on your mind?</Text>
          </Pressable>
          <Pressable accessibilityLabel="Photo" onPress={() => open('post')} style={{ padding: 8 }}><Icon name="image" size={24} color={c.positive} /></Pressable>
        </View>
        <ScrollView horizontal testID="stories-rail" showsHorizontalScrollIndicator={false} style={{ backgroundColor: c.surface }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable testID="create-story" onPress={() => open('story')} style={{ width: 96, height: 176, borderRadius: 8, borderWidth: 1, borderColor: '#e4e6eb', overflow: 'hidden' }}>
            <View style={{ flex: 1, backgroundColor: c.wash, alignItems: 'center', justifyContent: 'center' }}><Avatar name={data.me.name} color={data.me.avatarColor} size={48} /></View>
            <View style={{ height: 48, alignItems: 'center', paddingTop: 20 }}>
              <View style={{ position: 'absolute', top: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, borderWidth: 4, borderColor: c.surface, alignItems: 'center', justifyContent: 'center', boxSizing: 'content-box' } as object}><Icon name="plus" size={16} color={c.surface} /></View>
              <Text style={[t.meta, { fontFamily: font.semibold, color: c.ink }]}>Create story</Text>
            </View>
          </Pressable>
          {data.stories.map((g, i) => {
            const latest = g.stories[g.stories.length - 1];
            const photo = latest.photos[0] ?? g.stories.flatMap(s => s.photos)[0] ?? null;
            return <StoryTile key={g.author.id} testID="story-tile" name={g.mine ? 'Your story' : g.author.name} avatarName={g.author.name} color={g.author.avatarColor} photo={photo?.url} caption={latest.caption} onPress={() => setViewing(i)} />;
          })}
          {data.mockStories.map(s => <StoryTile key={s.id} name={s.name} avatarName={s.name} color={s.color} photo={s.photo} />)}
        </ScrollView>
      </View>
      {data.friendQueues.count > 0 && data.friendQueues.first ? <Pressable testID="home-friend-queues" onPress={() => router.push('/events?friends=1')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
        <FacePile people={data.friendQueues.faces} size={36} max={3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={t.bodyBold}>{data.friendQueues.count === 1 ? `${data.friendQueues.first.friend.name.split(' ')[0]} is queuing this weekend` : `${data.friendQueues.count} friends are queuing this weekend`}</Text>
          <Text numberOfLines={1} style={t.meta}>{data.friendQueues.count === 1 ? data.friendQueues.first.label : `${data.friendQueues.first.friend.name.split(' ')[0]}: ${data.friendQueues.first.label.charAt(0).toLowerCase()}${data.friendQueues.first.label.slice(1)}`} · Queue up too</Text>
        </View>
        <Icon name="chevron-right" color={c.muted} />
      </Pressable> : null}
      {data.posts.map(p => p.kind === 'real' ? <RealPost key={`r-${p.id}`} post={{ ...p, kind: 'post' }} ago={p.ago} onChanged={reload} />
        : <Post key={`m-${p.id}`} who={p.who} color={p.color} avatarUrl={p.avatar} ago={p.ago} text={p.text} likes={p.likes} comments={p.comments}>
          {p.event ? <Pressable testID="feed-event" onPress={() => router.push(`/events/${p.event!.id}`)}>
            <Cover color={p.event.coverColor} src={p.event.cover} label={p.event.title} />
            <View style={{ backgroundColor: c.wash, paddingHorizontal: 16, paddingVertical: 8 }}>
              <DateLine start={p.event.startsAt} />
              <Text numberOfLines={1} style={t.bodyBold}>{p.event.title}</Text>
              <Text numberOfLines={1} style={t.meta}>{p.event.venueName}</Text>
            </View>
          </Pressable> : p.photo ? <Cover color={p.color} src={p.photo} aspect={4 / 3} label={`Photo from ${p.who}`} /> : null}
        </Post>)}
      <Sheet open={compose !== null} onClose={() => setCompose(null)} title={compose === 'story' ? 'Create story' : 'Create post'} testID="home-composer-sheet">
        <View style={{ paddingHorizontal: 16 }}>
          {compose ? <Composer key={opens} albums={data.albums} initialKind={compose} onPosted={r => { setCompose(null); toast(r.kind === 'story' ? 'Added to your story' : 'Posted'); reload(); }} /> : null}
        </View>
      </Sheet>
      {viewing !== null ? <StoryViewer groups={data.stories} startGroup={viewing} onClose={() => setViewing(null)} /> : null}
    </>}
  </Screen>;
}

function StoryTile({ name, avatarName, color, photo, caption, onPress, testID }: { name: string; avatarName: string; color: string; photo?: string | null; caption?: string; onPress?: () => void; testID?: string }) {
  return <Pressable testID={testID} disabled={!onPress} onPress={onPress} accessibilityLabel={`${name}${name.endsWith('story') ? '' : "'s story"}`}
    style={{ width: 96, height: 176, borderRadius: 8, overflow: 'hidden', backgroundColor: photo ? color : c.ink }}>
    {photo ? <Image source={{ uri: asset(photo)! }} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} />
      : <Text style={{ color: c.surface, fontFamily: font.semibold, fontSize: 13, textAlign: 'center', padding: 8, marginTop: 60 }}>{caption?.slice(0, 60)}</Text>}
    <View style={{ position: 'absolute', top: 8, left: 8, borderRadius: 18, borderWidth: 2, borderColor: c.accent }}><Avatar name={avatarName} color={color} size={32} /></View>
    <Text numberOfLines={2} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,5,0.5)', color: c.surface, fontFamily: font.semibold, fontSize: 13, lineHeight: 16, paddingHorizontal: 8, paddingVertical: 6 }}>{name}</Text>
  </Pressable>;
}
