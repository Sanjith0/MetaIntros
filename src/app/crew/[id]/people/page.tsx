"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ME, profileById } from "@/data/seed";
import type { Icebreaker } from "@/lib/types";
import { Avatar, Card, MuseMark, TopBar } from "@/components/ui";

export default function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cards, setCards] = useState<(Icebreaker & { ai: boolean })[] | null>(null);
  useEffect(() => {
    fetch(`/api/crew/${id}/icebreakers?userId=${ME}`).then((r) => r.json()).then(setCards);
  }, [id]);
  return (
    <div className="min-h-dvh pb-6">
      <TopBar back={`/crew/${id}`} title="Icebreakers" />
      <div className="p-3 space-y-3">
        <p className="text-sm text-sub px-1 flex items-center gap-1.5"><MuseMark /> Written from what you both already share on Facebook. Nothing made up.</p>
        {!cards && (
          <Card><div className="h-16 rounded muse-shimmer opacity-20" /><p className="text-sm text-sub mt-2">Muse is writing your cards…</p></Card>
        )}
        {cards?.map((c) => {
          const p = profileById(c.toId)!;
          return (
            <Link key={c.toId} href={`/crew/${id}/people/${c.toId}`} className="block" data-testid={`card-${c.toId}`}>
              <Card className="flex gap-3 items-start">
                <Avatar p={p} size={52} />
                <div className="min-w-0">
                  <div className="font-semibold">{p.name} {p.lastName}</div>
                  <div className="text-[13px] text-sub">{p.work}</div>
                  <div className="text-[14px] mt-1 line-clamp-2">{c.hooks[0]?.text}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
