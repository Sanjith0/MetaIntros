"use client";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { EVENTS, ME, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { DEFAULT_FILTERS, post, saveFilters } from "@/lib/client";
import { Avatar, Button, Card, MuseMark, TopBar } from "@/components/ui";

export default function CrewSetup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const ev = EVENTS.find((e) => e.id === id)!;
  const me = profileById(ME)!;
  const [chips, setChips] = useState<string[]>(me.likes);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const toggle = (c: string) => setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  async function go() {
    setBusy(true);
    saveFilters(id, filters);
    await post("/api/queue/join", { eventId: id, userId: ME, filters, interests: chips });
    router.push(`/events/${id}/queue`);
  }

  return (
    <div className="min-h-dvh pb-28">
      <TopBar back={`/events/${id}`} title="Join a crew" />
      <div className="p-3 space-y-3">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar p={me} size={48} />
            <div>
              <div className="font-semibold">{me.name} {me.lastName}</div>
              <div className="text-sm text-sub">for {ev.title}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-1.5 font-semibold"><MuseMark /> Your taste profile</div>
          <p className="text-sm text-sub mt-1">From the Pages you like, your Groups and Events you&apos;ve been to. Tap to leave anything out.</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {me.likes.map((c) => (
              <button key={c} onClick={() => toggle(c)} className={`text-sm px-2.5 py-1 rounded-full border ${chips.includes(c) ? "bg-[#e7f0ff] border-fb text-fb" : "border-line text-sub line-through"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="text-sm text-sub mt-3">
            <b className="text-ink">Groups:</b> {me.groups.join(", ")}
          </div>
          <div className="text-sm text-sub mt-1">
            <b className="text-ink">Not into:</b> {me.dislikes.join(", ")}
          </div>
        </Card>

        <Card>
          <div className="font-semibold">When are you free?</div>
          <p className="text-sm text-sub mt-1">From {pretty(me.freeFrom)} on Saturday (from your calendar). Doors open at 7:30 PM.</p>
        </Card>

        <Card>
          <div className="font-semibold">Crew size</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[6, 7, 8].map((n) => (
              <button key={n} onClick={() => setFilters({ ...filters, crewSize: n })} className={`h-9 rounded-lg font-semibold ${filters.crewSize === n ? "bg-fb text-white" : "bg-[#e4e6eb]"}`}>
                {n}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="font-semibold">Safety</div>
          <label className="flex items-center justify-between py-2 border-b border-line/50">
            <span>
              <span className="block">Women &amp; non-binary only</span>
              <span className="text-xs text-sub">Only match with crews that fit this filter</span>
            </span>
            <input type="checkbox" data-testid="women-only" checked={filters.womenOnly} onChange={(e) => setFilters({ ...filters, womenOnly: e.target.checked })} className="w-5 h-5 accent-fb" />
          </label>
          <label className="flex items-center justify-between py-2">
            <span>
              <span className="block">Close to my age (±4 years)</span>
              <span className="text-xs text-sub">You&apos;re {me.age}</span>
            </span>
            <input type="checkbox" checked={filters.ageBand != null} onChange={(e) => setFilters({ ...filters, ageBand: e.target.checked ? 4 : null })} className="w-5 h-5 accent-fb" />
          </label>
          <p className="text-xs text-sub mt-1">Meetups are always at public places. Leave a crew anytime with one tap.</p>
        </Card>

        <label className="flex gap-2 items-start text-sm px-1">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-fb" />
          <span className="text-sub">Use my likes, groups, events and mutual friends to find my crew. Only my crew sees why we matched.</span>
        </label>
      </div>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] p-3 bg-white border-t border-line/60">
        <Button className="w-full h-12 text-[17px]" onClick={go} disabled={!consent || busy} data-testid="find-crew">
          {busy ? "Joining queue…" : "Find my crew"}
        </Button>
      </div>
    </div>
  );
}
