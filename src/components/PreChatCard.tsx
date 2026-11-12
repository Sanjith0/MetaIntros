"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ME, profileById } from "@/data/seed";
import type { PreChat } from "@/lib/prechat";
import { Avatar, Card, MuseMark } from "@/components/ui";

export function PreChatCard({ crewId, reveal }: { crewId: string; reveal: boolean }) {
  const [chats, setChats] = useState<PreChat[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/crew/${crewId}/prechat?userId=${ME}`).then((r) => r.json()).then(setChats);
  }, [crewId]);
  const me = profileById(ME)!;
  return (
    <Card>
      <div className="flex items-center gap-1.5 font-semibold"><MuseMark /> Agent pre-chat</div>
      <p className="text-[13px] text-sub mt-0.5">Your agent compared notes with each crewmate&apos;s agent, using only what you both share on Facebook. Agents never message people.</p>
      {!chats && <div className="h-12 mt-3 rounded-lg muse-shimmer opacity-20" />}
      <ul className="mt-2 divide-y divide-line/50" data-testid="prechat">
        {chats?.map((c) => {
          const p = profileById(c.bId)!;
          const isOpen = open === c.bId;
          return (
            <li key={c.bId} className="py-2">
              <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : c.bId)} data-testid={`prechat-${c.bId}`}>
                <Avatar p={p} size={36} blurred={!reveal} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px] flex items-center gap-2">
                    {p.name}
                    <span className="flex gap-0.5" aria-label={`Spark ${c.spark} of 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= c.spark ? "bg-muse" : "bg-line"}`} />
                      ))}
                    </span>
                  </div>
                  <div className="text-[13px] text-sub truncate">{c.summary}</div>
                </div>
                <ChevronDown size={18} className={`text-sub transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="mt-2 ml-12 space-y-1.5 fade-up" data-testid="prechat-transcript">
                  {c.turns.map((t, i) => (
                    <div key={i} className={`text-[13px] rounded-xl px-2.5 py-1.5 max-w-[90%] ${t.speaker === "a" ? "bg-[#e7f0ff]" : "bg-[#f3ecff] ml-auto"}`}>
                      <span className="font-semibold">{t.speaker === "a" ? `${me.name}'s agent` : `${p.name}'s agent`}: </span>
                      {t.text}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.topics.map((t) => (
                      <span key={t} className="text-[11px] font-semibold bg-fbbg px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                    {!c.ai && <span className="text-[11px] text-amber-700">template (no live model)</span>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
