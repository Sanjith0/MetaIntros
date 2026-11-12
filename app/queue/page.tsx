import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/events/Cover";
import { IconSparkle } from "@/components/icons";
import { QueueSheet } from "@/components/queue/QueueSheet";
import { DEMO_PARTY } from "@/fixtures";
import { eventWhen } from "@/lib/format";
import { candidatePlans, nightPlans, queueStatus } from "@/lib/server/queue";
import { friendsOf } from "@/lib/graph";
import { flag } from "@/lib/flags";
import { LABEL, memoryOf } from "@/lib/server/memory";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Find my party" };
export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ event?: string; duo?: string; group?: string }> }) {
  const { event: eventParam, duo, group } = await searchParams;
  const viewer = await currentViewerId();
  const s = store();
  const st = queueStatus(viewer);
  const eventId = eventParam ?? st?.entry.eventId ?? DEMO_PARTY.entryEventId;
  const e = s.events.get(eventId) ?? s.events.get(DEMO_PARTY.entryEventId)!;
  // A party that already locked (or found no plan) doesn't hold the sheet: you can queue for another night.
  const stParty = st?.partyId ? s.parties.get(st.partyId) : undefined;
  const active = st && (st.entry.status === "waiting" || (stParty && (stParty.status === "forming" || stParty.status === "talking"))) ? st : null;
  const placeholder = DEMO_PARTY.sentences[viewer] ?? "e.g. low-key, home by eleven, under $20";
  const me = s.profiles.get(viewer)!;
  const duoOn = flag("DUO_QUEUE");
  const friends = duoOn
    ? [...friendsOf(viewer)]
        .map((id) => s.profiles.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p && p.age >= 18 && !me.blocks.includes(p.id) && !p.blocks.includes(viewer))
        .map((p) => ({ id: p.id, name: p.name }))
    : [];
  const inviter = duo ? friends.find((f) => f.id === duo) ?? null : null;
  const standingGroup = group && flag("STANDING_QUEUE") ? s.standing.get(group) : undefined;
  const standing =
    standingGroup && standingGroup.memberIds.includes(viewer)
      ? { partyId: group!, others: standingGroup.memberIds.filter((id) => id !== viewer).map((id) => ({ id, firstName: s.profiles.get(id)!.firstName })) }
      : null;

  return (
    <main className="relative min-h-[calc(100vh-56px)]">
      {/* The event underneath, dimmed: the sheet is a layer on top of it */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <Cover hue={e.coverHue} title={e.title} className="h-[320px] w-full opacity-60" />
        <div className="absolute inset-0 bg-[var(--color-wash)]/70" />
      </div>
      <div className="relative mx-auto max-w-[560px] px-4 py-8">
        <div className="sheet-up overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-elevated)]" data-testid="queue-sheet">
          <div className="flex items-center gap-3 bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)] px-5 py-4 text-white">
            <IconSparkle size={22} />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">Party Queue</div>
              <div className="truncate text-[17px] font-bold">Find my party</div>
            </div>
            <Link href={`/event/${e.id}`} className="ml-auto text-[13px] font-semibold text-white/90 hover:underline">
              Close
            </Link>
          </div>
          <div className="flex items-center gap-3 border-b border-[var(--color-divider)] px-5 py-3">
            <Cover hue={e.coverHue} title={e.title} className="h-12 w-12 shrink-0" rounded="rounded-[8px]" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase text-[var(--color-date)]">{eventWhen(e.date, e.start)}</div>
              <div className="truncate text-[15px] font-semibold">{e.title}</div>
              <div className="text-[13px] text-[var(--color-ink-2)]">Your party can pick anything near {e.landmark} that night.</div>
            </div>
          </div>
          <QueueSheet
            key={viewer}
            eventId={e.id}
            landmark={e.landmark}
            placeholder={placeholder}
            isWoman={duoOn && me.gender === "woman"}
            initialSettings={me.settings}
            friends={friends}
            invitedBy={inviter}
            duoEnabled={duoOn}
            voice={flag("VOICE_SENTENCE")}
            editable={flag("EDIT_SENTENCE")}
            memory={flag("AGENT_MEMORY") ? memoryOf(viewer).map((m) => ({ tag: m.tag, label: LABEL[m.tag] ?? m.tag, from: m.from })) : []}
            standing={standing ?? (active?.group ? { partyId: active.group.of, others: (s.standing.get(active.group.of)?.memberIds ?? []).filter((id) => id !== viewer).map((id) => ({ id, firstName: s.profiles.get(id)!.firstName })) } : null)}
            night={flag("NIGHT_QUEUE") ? { nearCount: candidatePlans(e.landmark, e.date).length, tonightCount: nightPlans(e.date).length } : null}
            initialStatus={
              active
                ? { joinedAt: active.entry.joinedAt, inBucket: active.inBucket, needed: active.needed, partyId: active.partyId, landmark: active.entry.landmark, duo: active.duo, group: active.group, scope: active.entry.scope, sentence: active.sentence }
                : null
            }
          />
        </div>
      </div>
    </main>
  );
}
