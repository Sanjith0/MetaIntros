"use client";

import { useCallback, useState } from "react";
import { Check, ChevronRight, Clock, Images, UserPlus } from "lucide-react";
import { Avatar, Button, ButtonLink, IconCircle, ListRow, Section, Stack } from "@/components/fb";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";

type State = "add" | "requested" | "incoming" | "friends" | "unavailable";
interface Member { id: string; name: string; avatarColor: string; isSimulated?: boolean; state: State; sharedNote: string | null }
interface Data { partyId: string; eventTitle: string; over: boolean; members: Member[] }

/** After the event: add squadmates. Blue Add friend per row, as on Facebook's people lists. Only mutual adds connect. */
export function SquadConnect({ initial, sharePrompt = false }: { initial: Data; sharePrompt?: boolean }) {
  const [data, setData] = useState(initial);
  const reload = useCallback(() => fetch(`/api/squad/${initial.partyId}/connect`).then((r) => r.json()).then(setData).catch(() => {}), [initial.partyId]);
  useLiveEvents(["friends"], reload, reload);
  const add = async (id: string) => {
    setData((d) => ({ ...d, members: d.members.map((m) => (m.id === id ? { ...m, state: "requested" } : m)) }));
    await fetch(`/api/squad/${initial.partyId}/connect`, { method: "POST", body: JSON.stringify({ toId: id }) });
    reload();
  };
  const friends = data.members.filter((m) => m.state === "friends").length;
  return (
    <div data-testid="squad-connect">
      <TopBar back={`/squad/${initial.partyId}`} title="Stay in touch" />
      <Stack>
        <Section>
          <h1 className="text-headline font-bold">After {data.eventTitle}</h1>
          <p className="mt-1 text-body text-muted">You only become friends if you both tap Add friend. Nobody is told if you don&apos;t.</p>
          {!data.over && <p className="mt-2 rounded-card bg-wash p-3 text-meta text-muted">Friend requests open after the event.</p>}
        </Section>
        <Section flush className="pb-4">
          <ul>
            {data.members.map((m) => (
              <li key={m.id} data-testid={`connect-${m.id}`} data-state={m.state}>
                <ListRow
                  leading={<Avatar name={m.name} color={m.avatarColor} size={56} />}
                  title={m.name}
                  subtitle={m.sharedNote ? `You both love ${m.sharedNote}` : `Met at ${data.eventTitle}`}
                  meta={m.isSimulated ? "Sample person" : undefined}
                  trailing={
                    m.state === "friends" ? (
                      <Button variant="on" size="sm" disabled icon={<Check size={14} />}>Friends</Button>
                    ) : m.state === "requested" ? (
                      <Button size="sm" disabled icon={<Clock size={14} />}>Requested</Button>
                    ) : m.state === "unavailable" ? (
                      <span className="text-meta text-muted">Unavailable</span>
                    ) : (
                      <Button variant="primary" size="sm" disabled={!data.over} onClick={() => add(m.id)} data-testid={`add-${m.id}`} icon={<UserPlus size={14} />}>
                        {m.state === "incoming" ? "Confirm" : "Add friend"}
                      </Button>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </Section>
        {sharePrompt && (
          <Section flush>
            <ListRow
              href={`/squad/${initial.partyId}/share`}
              testId="connect-share"
              leading={<IconCircle><Images size={18} /></IconCircle>}
              title="Share the outing"
              subtitle="Post photos from your squad album, or skip it"
              trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
            />
          </Section>
        )}
        {friends > 0 && (
          <Section>
            <ButtonLink href="/friends?tab=queueup" block data-testid="see-new-friends">
              See your new friends ({friends})
            </ButtonLink>
          </Section>
        )}
      </Stack>
    </div>
  );
}
