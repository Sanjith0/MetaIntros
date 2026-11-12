"use client";
import Link from "next/link";
import { use, useState } from "react";
import { EVENTS, ME, VENUES, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { post } from "@/lib/client";
import { useCrew } from "@/lib/useCrew";
import type { CrewView } from "@/lib/types";
import { Avatar, Button, Card, MuseMark, TopBar } from "@/components/ui";
import { MiniMap } from "@/components/MiniMap";
import { PreChatCard } from "@/components/PreChatCard";

export default function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { crew, setCrew, missing } = useCrew(id);
  const [showHow, setShowHow] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (missing) return <Missing />;
  if (!crew) return <div className="p-6 text-sub">Loading crew…</div>;
  const ev = EVENTS.find((e) => e.id === crew.eventId)!;
  const venue = VENUES.find((v) => v.id === crew.plan.venueId)!;
  const iAccepted = crew.accepted.includes(ME);
  const reveal = crew.allAccepted;

  return (
    <div className="min-h-dvh pb-28">
      <TopBar back={`/events/${crew.eventId}`} title="Your crew" />
      <div className="p-3 space-y-3">
        <Card>
          <div className="text-[13px] text-sub">{ev.title} · Sat {pretty(ev.startTime)}</div>
          <h1 className="font-bold text-xl mt-0.5">{crew.vibe || "Your crew"}</h1>
          <p className="text-[15px] mt-1">{crew.rationale}</p>
          {crew.aiMode === "fallback" && <p className="text-xs text-amber-700 mt-1">Built by the fallback matcher (no live model).</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[17px]">{crew.memberIds.length} people</h2>
            <span className="text-sm text-sub" data-testid="accept-count">
              {crew.accepted.length}/{crew.memberIds.length} in
            </span>
          </div>
          {!reveal && <p className="text-xs text-sub mt-1">🔒 Photos and last names unlock when everyone accepts.</p>}
          {reveal && <p className="text-xs text-green-700 mt-1 fade-up" data-testid="revealed">🔓 Everyone&apos;s in. Photos unlocked.</p>}
          <ul className="mt-3 divide-y divide-line/50">
            {crew.memberIds.map((mid) => {
              const p = profileById(mid)!;
              const me = mid === ME;
              const ok = crew.accepted.includes(mid);
              return (
                <li key={mid} className="py-2.5 flex gap-3 items-center">
                  <Avatar p={p} size={44} blurred={!reveal && !me} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {p.name} {reveal || me ? p.lastName : `${p.lastName[0]}.`}{" "}
                      <span className="font-normal text-sub text-sm">· {p.age} · {p.pronouns}</span>
                    </div>
                    <div className="text-[13px] text-sub truncate">{me ? "You" : crew.whyMember[mid] || p.bio}</div>
                  </div>
                  <span className={`text-xs font-semibold ${ok ? "text-green-600" : "text-sub"}`}>{ok ? "✓ In" : "…"}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <PreChatCard crewId={crew.id} reveal={reveal} />

        <Card>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muse"><MuseMark /> Meetup picked for all {crew.memberIds.length}</div>
          <div className="font-bold text-[17px] mt-1" data-testid="meetup">{venue.name} · {pretty(crew.plan.time)}</div>
          <div className="text-sm text-sub">{venue.blurb}</div>
          <ul className="mt-2 space-y-1 text-[14px]">
            {crew.plan.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          <MiniMap crew={crew} />
        </Card>

        {crew.swaps.length > 0 && (
          <Card>
            <button className="w-full flex items-center justify-between font-semibold" onClick={() => setShowHow((x) => !x)}>
              <span className="flex items-center gap-1.5"><MuseMark /> How this crew was built</span>
              <span className="text-sub">{showHow ? "−" : "+"}</span>
            </button>
            {showHow && (
              <ul className="mt-2 space-y-2 text-[14px]">
                {crew.swaps.map((s) => (
                  <li key={s.out} className="bg-fbbg rounded-lg p-2.5">
                    <b>Swapped {profileById(s.out)!.name} for {profileById(s.in)!.name}.</b> {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {reveal && (
          <div className="grid grid-cols-3 gap-2 fade-up">
            <Link href={`/crew/${id}/chat`} className="bg-white rounded-xl p-3 text-center shadow-sm" data-testid="open-chat">
              <div className="text-2xl">💬</div>
              <div className="text-sm font-semibold">Crew chat</div>
            </Link>
            <Link href={`/crew/${id}/people`} className="bg-white rounded-xl p-3 text-center shadow-sm" data-testid="open-icebreakers">
              <div className="text-2xl">🧊</div>
              <div className="text-sm font-semibold">Icebreakers</div>
            </Link>
            <Link href={`/crew/${id}/live`} className="bg-white rounded-xl p-3 text-center shadow-sm" data-testid="open-live">
              <div className="text-2xl">📍</div>
              <div className="text-sm font-semibold">I&apos;m here</div>
            </Link>
          </div>
        )}
      </div>

      <div className="px-3 pb-6 text-center">
        {!confirmLeave ? (
          <button className="text-[13px] text-sub underline" onClick={() => setConfirmLeave(true)} data-testid="leave-crew">
            Leave this crew
          </button>
        ) : (
          <div className="bg-white rounded-xl p-3 shadow-sm text-[14px]">
            <p>Leave the crew? Nobody gets a reason, and the plan continues without you.</p>
            <div className="flex gap-2 mt-2 justify-center">
              <Button variant="secondary" onClick={() => setConfirmLeave(false)}>Stay</Button>
              <Button
                data-testid="confirm-leave"
                onClick={async () => {
                  await post(`/api/crew/${id}/leave`, { userId: ME });
                  location.href = `/events/${crew.eventId}`;
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        )}
      </div>

      {!iAccepted && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] p-3 bg-white border-t border-line/60 flex gap-2">
          <Button variant="secondary" className="h-12" onClick={() => history.back()}>Not this time</Button>
          <Button className="flex-1 h-12 text-[17px]" data-testid="accept-crew" onClick={async () => setCrew(await post<CrewView>(`/api/crew/${id}/accept`, { userId: ME }))}>
            I&apos;m in
          </Button>
        </div>
      )}
    </div>
  );
}

function Missing() {
  return (
    <div className="p-6">
      <p className="text-sub">This crew doesn&apos;t exist anymore (the demo server may have restarted).</p>
      <Link className="text-fb" href="/events/pale-hour">Back to the event</Link>
    </div>
  );
}
