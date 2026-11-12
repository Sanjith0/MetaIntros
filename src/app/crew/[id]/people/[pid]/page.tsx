"use client";
import { use, useEffect, useState } from "react";
import { ME, profileById } from "@/data/seed";
import type { Icebreaker } from "@/lib/types";
import { Avatar, MuseMark, TopBar } from "@/components/ui";

const label = (e: string) => {
  const k = e.slice(0, e.indexOf(":"));
  return { likes: "You both like", group: "Both in group", event: "Both went to", friend: "Mutual friend", school: "Same school" }[k] ?? k;
};

export default function CardPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  const [card, setCard] = useState<(Icebreaker & { ai: boolean }) | null>(null);
  useEffect(() => {
    fetch(`/api/crew/${id}/icebreakers?userId=${ME}`)
      .then((r) => r.json())
      .then((cs: (Icebreaker & { ai: boolean })[]) => setCard(cs.find((c) => c.toId === pid) ?? null));
  }, [id, pid]);
  const p = profileById(pid)!;
  return (
    <div className="min-h-dvh pb-6 bg-gradient-to-b from-[#f3ecff] to-fbbg">
      <TopBar back={`/crew/${id}/people`} title={p.name} />
      <div className="p-4">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden" data-testid="icebreaker-card">
          <div className="h-24" style={{ background: `linear-gradient(135deg, hsl(${p.hue} 75% 70%), hsl(${(p.hue + 60) % 360} 70% 55%))` }} />
          <div className="px-5 pb-5 -mt-12">
            <Avatar p={p} size={96} ring="#fff" />
            <h1 className="text-2xl font-bold mt-2">{p.name} {p.lastName}</h1>
            <div className="text-sub text-sm">{p.pronouns} · {p.age} · {p.work}</div>
            <p className="text-[15px] mt-2 italic">“{p.bio}”</p>

            <h2 className="mt-5 text-[13px] font-bold tracking-wide text-muse flex items-center gap-1.5"><MuseMark /> WHAT YOU SHARE</h2>
            {!card && <p className="text-sm text-sub mt-2">Writing…</p>}
            <ul className="mt-2 space-y-2">
              {card?.hooks.map((h) => (
                <li key={h.evidence} className="bg-fbbg rounded-xl p-3 fade-up">
                  <div className="text-[11px] uppercase font-semibold text-sub">{label(h.evidence)} · {h.evidence.slice(h.evidence.indexOf(":") + 1)}</div>
                  <div className="text-[15px] mt-0.5">{h.text}</div>
                </li>
              ))}
            </ul>
            {card && (
              <div className="mt-4 rounded-xl p-3 border-2 border-muse/30 bg-[#faf7ff] fade-up" data-testid="opener">
                <div className="text-[11px] font-bold text-muse">TRY OPENING WITH</div>
                <div className="text-[17px] font-semibold mt-0.5">{card.opener}</div>
              </div>
            )}
            {card && card.mutualFriends.length > 0 && <div className="text-sm text-sub mt-3">👥 Mutual friends: {card.mutualFriends.join(", ")}</div>}
            {card && !card.ai && <div className="text-[11px] text-amber-700 mt-3">Template text (no live model). Every line is grounded in real shared data.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
