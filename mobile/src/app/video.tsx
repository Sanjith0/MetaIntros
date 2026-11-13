import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Chip } from '../qu/QueueSetup';
import { useData } from '../qu/hooks';
import { Avatar, Cover, ErrorNote, Icon, Loading, Screen, c, t } from '../qu/ui';

interface Video { id: string; page: string; color: string; avatar: string; thumb: string; title: string; views: string; ago: string }

/** Seeded mock of the Video tab (app/(app)/video/page.tsx): outside the Link path, but it doesn't dead-end. */
export default function VideoScreen() {
  const { data, error, reload } = useData<{ videos: Video[] }>('/api/m/video');
  return <Screen title="Video" testID="video-page">
    <ScrollView horizontal style={{ backgroundColor: c.surface }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
      <Chip on onPress={() => {}}>For you</Chip><Chip on={false} onPress={() => {}}>Live</Chip><Chip on={false} onPress={() => {}}>Following</Chip>
    </ScrollView>
    {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />) : data.videos.map(v => <View key={v.id} style={{ backgroundColor: c.surface, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Avatar name={v.page} color={v.color} photoUrl={v.avatar} />
        <View><Text style={t.bodyBold}>{v.page}</Text><Text style={t.meta}>{v.ago}</Text></View>
      </View>
      <Text style={[t.body, { paddingHorizontal: 16, paddingBottom: 8 }]}>{v.title}</Text>
      <View>
        <Cover color={v.color} src={v.thumb} aspect={16 / 9} label={v.title} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View accessibilityLabel="Play (off in this prototype)" style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color={c.surface} /></View>
        </View>
      </View>
      <Text style={[t.meta, { paddingHorizontal: 16, paddingTop: 8 }]}>{v.views}</Text>
    </View>)}
  </Screen>;
}
