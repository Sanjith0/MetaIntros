import { ChevronRight } from "lucide-react";
import { FacePile, ListRow, Section } from "@/components/fb";
import { fmtEventWhen } from "@/lib/format";
import type { ActiveSquad } from "@/lib/server/squads";

/**
 * "Your squads": every squad you're in right now, soonest first, each opening its squad chat.
 * The Events tab shows it when the status card can't cover them all (two or more squads, or one
 * squad while you're queuing for the next).
 */
export function MySquads({ squads }: { squads: ActiveSquad[] }) {
  return (
    <Section flush title={`Your squads · ${squads.length}`} testId="my-squads">
      <ul>
        {squads.map((s) => (
          <li key={s.partyId}>
            <ListRow
              href={s.chatId ? `/chats/${s.chatId}` : `/squad/${s.partyId}`}
              testId={`my-squad-${s.partyId}`}
              data={{ hangout: s.hangout }}
              leading={<FacePile people={s.faces.slice(0, 2)} size={40} max={2} />}
              title={s.name}
              subtitle={<span className="block truncate">{fmtEventWhen(new Date(s.startsAt))} · {s.hangout ? "New hangout" : s.venueName}</span>}
              trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
