import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/events/Cover";
import { IconChat, IconDoor, IconLock, IconPin, IconSparkle } from "@/components/icons";
import { PartyLive } from "@/components/party/PartyLive";
import { SecretPanel } from "@/components/party/SecretPanel";
import { flag } from "@/lib/flags";
import { secretView } from "@/lib/server/secret";
import { clock12, dayLabel, price } from "@/lib/format";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { memberPartyViewForViewer } from "@/lib/server/views";
import { queueStatus } from "@/lib/server/queue";

export const metadata: Metadata = { title: "Your party" };
export const dynamic = "force-dynamic";

export default async function PartyPage() {
  const viewer = await currentViewerId();
  const v = memberPartyViewForViewer(viewer);
  const s = store();

  if (!v) {
    const q = queueStatus(viewer);
    return (
      <main className="mx-auto max-w-[680px] px-4 py-8">
        <PartyLive />
        <div className="rounded-[12px] bg-white p-6 text-center shadow-[var(--shadow-card)]" data-testid="no-party">
          <IconSparkle size={28} className="mx-auto text-[var(--color-pq)]" />
          <h1 className="mt-2 text-[20px] font-bold">{q?.entry.status === "waiting" ? "You're in the queue" : "No party yet"}</h1>
          <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">
            {q?.entry.status === "waiting" ? `${q.inBucket} of 5 near ${q.entry.landmark}. We'll notify you when your party is set.` : "Open any event and tap Find my party."}
          </p>
          <Link href={q?.entry.status === "waiting" ? "/queue" : "/events"} className="press mt-4 inline-flex rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-[15px] font-semibold text-white">
            {q?.entry.status === "waiting" ? "See the queue" : "Browse events"}
          </Link>
        </div>
      </main>
    );
  }

  const plan = v.party.planId ? s.plans.get(v.party.planId) : undefined;
  const event = plan ? s.events.get(plan.eventId) : undefined;
  const locked = v.party.status === "locked" && plan;
  const myOwnVerdicts = s.verdicts.filter((x) => x.partyId === v.party.id && x.ownerId === viewer && x.round === 1);
  const others = v.members.filter((m) => m.id !== viewer);
  const cardFor = (id: string) => v.cards.find((c) => c.subjectId === id);
  const secret = flag("SECRET_PANEL") ? secretView(v.party.id, viewer) : null;

  return (
    <main className="mx-auto grid max-w-[1040px] grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[1fr_380px]">
      <PartyLive />
      <div className="flex flex-col gap-4">
        {/* The party card: our layer */}
        <section className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--color-pq)]/20" data-testid="party-card">
          <div className="relative">
            {event ? <Cover hue={event.coverHue} title={event.title} className="h-[120px] w-full" /> : <div className="h-[120px] bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)]" />}
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-pq)]">
              <IconSparkle size={14} /> Party Queue
            </span>
          </div>
          <div className="p-4">
            {locked ? (
              <>
                <div className="text-[13px] font-semibold uppercase text-[var(--color-date)]">
                  {dayLabel(plan.date)} · {clock12(plan.start)} – {clock12(plan.end)}
                </div>
                <h1 className="text-[24px] font-bold leading-tight" data-testid="party-plan-title">
                  {plan.title}
                </h1>
                <div className="text-[15px] text-[var(--color-ink-2)]">
                  {plan.venueName} · {price(plan.priceUsd)} · locked by {v.party.lockedBy === "signatures" ? "all five signatures" : "code, after three rounds"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/chat/${v.party.chatId}`} data-testid="open-party-chat" className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-pq)] px-3 text-[15px] font-semibold text-white">
                    <IconChat size={18} /> Group chat
                  </Link>
                  <Link href={`/event/${plan.eventId}`} className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-btn-2)] px-3 text-[15px] font-semibold">
                    Event · 5 going
                  </Link>
                  <Link href="/door" className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-btn-2)] px-3 text-[15px] font-semibold">
                    <IconDoor size={18} /> At the door
                  </Link>
                  <Link href="/runitback" data-testid="open-runitback" className="press flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--color-btn-2)] px-3 text-[15px] font-semibold">
                    Run it back
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-[22px] font-bold" data-testid="party-status">
                  {v.party.status === "failed" ? "No plan worked tonight" : "Your agents are talking"}
                </h1>
                <p className="text-[15px] text-[var(--color-ink-2)]">Five agents, one table. Code locks the plan the moment all five sign.</p>
              </>
            )}
          </div>
          <ul className="border-t border-[var(--color-divider)]" data-testid="party-members">
            {others.map((m) => {
              const c = cardFor(m.id);
              return (
                <li key={m.id} className="flex gap-3 border-b border-[var(--color-divider)] px-4 py-3 last:border-b-0">
                  <Avatar name={m.name} hue={m.hue} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{m.name}</div>
                    {m.bridge && <div className="text-[13px] text-[var(--color-ink-2)]">{m.bridge}</div>}
                    {c?.sharedLine && c.sharedLine !== m.bridge && <div className="mt-0.5 text-[13px] font-semibold text-[var(--color-pq-ink)]">{c.sharedLine}</div>}
                    {c && (
                      <div className="mt-1 rounded-[8px] bg-[var(--color-pq-soft)] px-2.5 py-1.5 text-[13px]">
                        <span className="font-semibold text-[var(--color-pq)]">Say: </span>
                        {c.opener}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {secret && <SecretPanel v={secret} />}

        {/* The public table */}
        <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="party-table">
          <h2 className="text-[17px] font-semibold">The table</h2>
          <p className="mb-2 text-[13px] text-[var(--color-ink-2)]">What all five agents said out loud.</p>
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {v.plans.map((p) => (
              <li
                key={p.id}
                className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                  p.id === v.party.planId ? "bg-[var(--color-positive)] text-white" : p.unavailable ? "bg-[var(--color-btn-2)] text-[var(--color-ink-2)] line-through" : "bg-[var(--color-on-bg)] text-[var(--color-on-ink)]"
                }`}
              >
                {p.title}
                {p.unavailable ? " · unavailable" : ""}
              </li>
            ))}
          </ul>
          <ol className="flex flex-col gap-1.5">
            {v.table.map((t) => {
              const who = t.authorId ? v.members.find((m) => m.id === t.authorId) : undefined;
              return (
                <li key={t.id} className="flex items-start gap-2 text-[15px]">
                  {who ? <Avatar name={who.name} hue={who.hue} size={24} /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-btn-2)] text-[10px] font-bold text-[var(--color-ink-2)]">PQ</span>}
                  <span className={t.authorId ? "" : "text-[var(--color-ink-2)]"}>
                    {who && <span className="font-semibold">{who.firstName}'s agent: </span>}
                    {t.text}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* Your receipt: only you see this */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="receipt">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold">
            <IconLock size={18} /> Your agent's receipt
          </h2>
          <p className="mb-3 text-[13px] text-[var(--color-ink-2)]">Only you see this. Your party saw none of it.</p>
          {(v.receipt?.considered ?? myOwnVerdicts.map((x) => ({ planId: x.planId, title: s.plans.get(x.planId)?.title ?? x.planId, preference: x.preference }))).length === 0 ? (
            <div className="text-[13px] text-[var(--color-ink-2)]">Your agent is reading the plans…</div>
          ) : (
            <>
              <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">Considered</div>
              <ul className="mb-3 mt-1 space-y-1 text-[13px]">
                {(v.receipt?.considered ?? myOwnVerdicts.map((x) => ({ planId: x.planId, title: s.plans.get(x.planId)?.title ?? x.planId, preference: x.preference }))).map((c) => (
                  <li key={c.planId} className="flex justify-between gap-2">
                    <span>{c.title}</span>
                    <span className="text-[var(--color-ink-2)]">{"★".repeat(c.preference)}</span>
                  </li>
                ))}
              </ul>
              {!secret && <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">Turned down for you</div>}
              <ul className="mb-3 mt-1 space-y-1 text-[13px]">
                {(secret ? [] : v.receipt?.rejected ?? myOwnVerdicts.filter((x) => x.decision === "reject").map((x) => ({ planId: x.planId, title: s.plans.get(x.planId)?.title ?? "", reason: x.privateReason, byCode: x.overriddenByCode }))).map((r) => (
                  <li key={r.planId}>
                    <span className="font-semibold">{r.title}:</span> {r.reason}
                    {r.byCode && <span className="ml-1 rounded bg-[var(--color-btn-2)] px-1 text-[11px]">code</span>}
                  </li>
                ))}
              </ul>
              {v.receipt && (
                <>
                  <div className="text-[13px] font-semibold text-[var(--color-ink-3)]">Told the party</div>
                  <ul className="mt-1 space-y-1 text-[13px]">
                    {v.receipt.toldParty.map((t, i) => (
                      <li key={i}>
                        <span className="text-[var(--color-ink-2)]">Round {t.round}:</span> “{t.text}”
                      </li>
                    ))}
                  </ul>
                  {v.receipt.blockedLines > 0 && <div className="mt-2 text-[12px] text-[var(--color-ink-2)]">The verifier replaced {v.receipt.blockedLines} line with a neutral phrase.</div>}
                  {(v.receipt.fallbackRounds ?? []).length > 0 && (
                    <div className="mt-2 rounded-[6px] bg-[#fff4e0] px-2 py-1.5 text-[12px] text-[#7a4b00]" data-testid="receipt-fallback">
                      In round {v.receipt.fallbackRounds.join(" and ")} your agent didn't answer in time, so the rule-based fallback answered for it, using the same rules.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
        {locked && (
          <section className="rounded-[8px] bg-white p-4 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <IconPin size={16} /> Every line here traces to something someone approved.
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-ink-2)]">Shared lines and openers are built only from facts each person approved and connections both people agreed to show.</p>
          </section>
        )}
      </aside>
    </main>
  );
}
