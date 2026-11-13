import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, FacePile, IconCircle, Progress, c, go, t } from './ui';
import { fmtDuration, fmtEventWhen } from './format';

export type StatusCardData =
  | { state: 'waiting'; title: string; found: number; targetSize: number; bucketName?: string | null; waitedMs: number; action: { label: string; href: string } }
  | { state: 'accept'; title: string; accepted: boolean; inCount: number; size: number; action: { label: string; href: string } }
  | { state: 'ready' | 'venue' | 'after'; title: string; startsAt: string; venueName: string; checkedIn?: boolean; faces: { id: string; name: string; avatarColor: string }[]; action: { label: string; href: string }; secondary?: { label: string; href: string } };

/** The single Queue Up status card: one state, one line of context, one next action. */
export function StatusCard({ card, onEventPage = false }: { card: StatusCardData; onEventPage?: boolean }) {
  const [elapsed, setElapsed] = useState(card.state === 'waiting' ? card.waitedMs : 0);
  const base = useRef({ at: Date.now(), waited: card.state === 'waiting' ? card.waitedMs : 0 });
  useEffect(() => {
    if (card.state !== 'waiting') return;
    base.current = { at: Date.now(), waited: card.waitedMs };
    const timer = setInterval(() => setElapsed(base.current.waited + Date.now() - base.current.at), 1000);
    return () => clearInterval(timer);
  }, [card]);

  if (card.state === 'waiting') return <View testID="status-card" style={{ backgroundColor: c.surface, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconCircle name="clock" on size={40} />
      <View style={{ flex: 1 }}>
        <Text style={t.bodyBold}>Finding your squad</Text>
        <Text numberOfLines={1} style={t.meta}>{card.title} · {card.found} of {card.targetSize} found{card.bucketName ? ` near ${card.bucketName}` : ''}</Text>
      </View>
      <Text style={t.meta}>{fmtDuration(elapsed)}</Text>
    </View>
    <Progress value={card.found} max={card.targetSize} />
    <Button variant="primary" onPress={() => go(card.action.href)} testID="status-action">{card.action.label}</Button>
  </View>;

  if (card.state === 'accept') return <View testID="status-card" style={{ backgroundColor: c.surface, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconCircle name="check" on size={40} />
      <View style={{ flex: 1 }}>
        <Text style={t.bodyBold}>{card.accepted ? "You're in" : 'We found your squad'}</Text>
        <Text numberOfLines={1} style={t.meta}>{card.title} · {card.inCount} of {card.size} in</Text>
      </View>
    </View>
    <Button variant="primary" onPress={() => go(card.action.href)} testID="status-action">{card.action.label}</Button>
  </View>;

  const when = fmtEventWhen(card.startsAt);
  const sharing = card.state === 'after' && card.action.href.endsWith('/share');
  const copy = {
    ready: onEventPage ? { title: 'Your squad is going', sub: `${card.faces.length} people` } : { title: `Your squad is going to ${card.title}`, sub: `${when} · ${card.faces.length} people` },
    venue: { title: card.checkedIn ? "You're checked in" : `${card.title} is starting`, sub: `Meet at the front entrance · ${card.venueName}` },
    after: sharing ? { title: `How was ${card.title}?`, sub: 'Share photos from your squad album' } : { title: `How was ${card.title}?`, sub: 'Only mutual adds become friends' },
  }[card.state];
  return <View testID="squad-banner" style={{ backgroundColor: c.surface, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <FacePile people={card.faces} size={32} max={4} />
      <View style={{ flex: 1 }}>
        <Text style={t.bodyBold}>{copy.title}</Text>
        <Text style={t.meta}>{copy.sub}</Text>
      </View>
    </View>
    <Button variant="primary" icon={card.action.href.startsWith('/chats/') ? 'message-circle' : 'calendar'} onPress={() => go(card.action.href)} testID="status-action">{card.action.label}</Button>
    {card.secondary ? <Text onPress={() => go(card.secondary!.href)} style={[t.link, { textAlign: 'center' }]}>{card.secondary.label}</Text> : null}
  </View>;
}
