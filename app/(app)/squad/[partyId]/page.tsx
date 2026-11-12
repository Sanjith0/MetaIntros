import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, MapPin, MessageCircle, MessageSquareQuote, Clock } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, FacePile, IconCircle, ListRow, Section, Stack } from "@/components/fb";
import { TraceRow } from "@/components/trace/TraceList";
import { getPartyForUser, isRevealed } from "@/lib/server/party";
import { getCurrentUserId } from "@/lib/server/session";
import { squadName } from "@/lib/server/squadChat";
import { fmtEventWhen, fmtTime } from "@/lib/format";

function RoundAction({ href, label, icon, testId }: { href: string; label: string; icon: React.ReactNode; testId?: string }) {
  return (
    <Link href={href} data-testid={testId} className="press flex w-20 flex-col items-center gap-1.5 text-meta">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-control text-ink">{icon}</span>
      {label}
    </Link>
  );
}

/** Squad info, modelled on Messenger's chat info: who, when, where, and rows for the deeper features. */
export default async function SquadInfo({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const me = await getCurrentUserId();
  const p = await getPartyForUser(me, partyId);
  if (!p?.event || !isRevealed(p.status)) notFound();
  const ev = p.event;
  const people = p.members.map((m) => ({ ...m.user, checkedIn: Boolean(m.checkedInAt) }));
  const others = people.filter((u) => u.id !== me);
  return (
    <div data-testid="squad-info-page">
      <TopBar back={p.chat ? `/chats/${p.chat.id}` : "/events"} title="Squad info" />
      <Stack>
        <Section className="pt-5 pb-4 text-center">
          <FacePile people={others} size={56} max={3} className="justify-center" />
          <h1 className="mt-3 text-headline font-bold">{squadName(ev.title)}</h1>
          <p className="text-meta text-muted">{people.length} people · {p.chat?.archived ? "chat ended" : "chat ends 24h after the event"}</p>
          <div className="mt-4 flex justify-center gap-2">
            {p.chat && <RoundAction href={`/chats/${p.chat.id}`} label="Chat" icon={<MessageCircle size={20} />} testId="info-chat" />}
            <RoundAction href={`/events/${ev.id}`} label="Event" icon={<CalendarDays size={20} />} testId="info-event" />
            <RoundAction href={`/squad/${partyId}/find`} label="I'm here" icon={<MapPin size={20} />} testId="info-find" />
          </div>
        </Section>

        <Section flush title="Plan">
          <ListRow leading={<IconCircle><CalendarDays size={18} /></IconCircle>} title={ev.title} subtitle={fmtEventWhen(ev.startsAt, ev.endsAt)} href={`/events/${ev.id}`} />
          <ListRow leading={<IconCircle><MapPin size={18} /></IconCircle>} title={`Meet at the front entrance, ${ev.venueName}`} subtitle={ev.venueAddress} href={`/squad/${partyId}/find`} trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
          <ListRow leading={<IconCircle><Clock size={18} /></IconCircle>} title={`Doors at ${fmtTime(ev.startsAt)}`} subtitle="Meet 10 minutes early so you can walk in together." />
        </Section>

        <Section flush>
          <ListRow href={`/squad/${partyId}/cards`} testId="open-talk-cards" leading={<IconCircle><MessageSquareQuote size={18} /></IconCircle>} title="Talk cards" subtitle="What you have in common with each person" trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
          <ListRow href={`/squad/${partyId}/find`} testId="open-find" leading={<IconCircle><MapPin size={18} /></IconCircle>} title="Find each other" subtitle="Check in at the door and see who's here" trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
          <TraceRow partyId={partyId} />
        </Section>

        <Section flush title={`Members · ${people.length}`} className="pb-4">
          <ul data-testid="squad-members">
            {people.map((u) => (
              <li key={u.id}>
                <ListRow
                  href={u.id === me ? undefined : `/squad/${partyId}/cards?member=${u.id}`}
                  testId={`member-avatar-${u.id}`}
                  leading={<Avatar name={u.name} color={u.avatarColor} size={40} />}
                  title={u.id === me ? `${u.name} (you)` : u.name}
                  subtitle={[u.checkedIn ? "Here" : null, u.id !== me && u.isSimulated && !u.isLive ? "Sample person" : null].filter(Boolean).join(" · ") || undefined}
                  trailing={u.id === me ? null : <ChevronRight size={20} className="text-muted" aria-hidden />}
                />
              </li>
            ))}
          </ul>
        </Section>
      </Stack>
    </div>
  );
}
