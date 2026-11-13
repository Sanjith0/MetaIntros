import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../qu/hooks';
import { asset } from '../qu/api';
import { Avatar, Cover, DateLine, ErrorNote, FacePile, Icon, Loading, Screen, c, t } from '../qu/ui';
import { Image } from 'react-native';

type Post = {
  kind: 'mock' | 'real'; id: string; who?: string; color?: string; avatar?: string; ago: string; text?: string; caption?: string; photo?: string;
  likes?: number; comments?: number; author?: { name: string; avatarColor: string };
  event?: { id: string; title: string; startsAt: string; venueName: string; coverColor: string; cover: string | null } | null;
  photos?: { url?: string; src?: string }[];
};
interface HomeData { me: { name: string; avatarColor: string }; friendQueues: { count: number; first: { friend: { name: string }; label: string } | null; faces: { id: string; name: string; avatarColor: string }[] }; posts: Post[] }

export default function HomeScreen() {
  const { data, error, reload } = useData<HomeData>('/api/m/home');
  return <Screen title="facebook" tabs testID="home-page">
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : <>
      {data.friendQueues.count > 0 && data.friendQueues.first ? <Pressable onPress={() => router.push('/events')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, padding: 16 }}>
        <FacePile people={data.friendQueues.faces} size={36} max={3} />
        <View style={{ flex: 1 }}>
          <Text style={t.bodyBold}>{data.friendQueues.count === 1 ? `${data.friendQueues.first.friend.name.split(' ')[0]} is queuing this weekend` : `${data.friendQueues.count} friends are queuing this weekend`}</Text>
          <Text numberOfLines={1} style={t.meta}>{data.friendQueues.first.label} · Queue up too</Text>
        </View>
        <Icon name="chevron-right" color={c.muted} />
      </Pressable> : null}
      {data.posts.map(p => {
        const name = p.who ?? p.author?.name ?? 'Someone';
        const photo = p.photo ?? p.photos?.[0]?.url ?? p.photos?.[0]?.src;
        return <View key={`${p.kind}-${p.id}`} style={{ backgroundColor: c.surface, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
            <Avatar name={name} color={p.color ?? p.author?.avatarColor} photoUrl={p.avatar} />
            <View><Text style={t.bodyBold}>{name}</Text><Text style={t.meta}>{p.ago}</Text></View>
          </View>
          {p.text ?? p.caption ? <Text style={[t.body, { paddingHorizontal: 16, paddingVertical: 8 }]}>{p.text ?? p.caption}</Text> : <View style={{ height: 8 }} />}
          {p.event ? <Pressable onPress={() => router.push(`/events/${p.event!.id}`)}>
            <Cover color={p.event.coverColor} src={p.event.cover} label={p.event.title} />
            <View style={{ backgroundColor: c.wash, paddingHorizontal: 16, paddingVertical: 8 }}>
              <DateLine start={p.event.startsAt} />
              <Text numberOfLines={1} style={t.bodyBold}>{p.event.title}</Text>
              <Text numberOfLines={1} style={t.meta}>{p.event.venueName}</Text>
            </View>
          </Pressable> : photo ? <Image source={{ uri: asset(photo)! }} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: c.control }} /> : null}
          {p.likes != null ? <Text style={[t.meta, { padding: 12, paddingHorizontal: 16 }]}>{p.likes} likes · {p.comments} comments</Text> : <View style={{ height: 12 }} />}
        </View>;
      })}
    </>}
  </Screen>;
}
