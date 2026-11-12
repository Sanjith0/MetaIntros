"use client";
import Link from "next/link";
import { use } from "react";
import { ME, VENUES, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { post } from "@/lib/client";
import { useCrew } from "@/lib/useCrew";
import type { CrewView } from "@/lib/types";
import { Avatar, Button, Card, TopBar } from "@/components/ui";
import { MiniMap } from "@/components/MiniMap";

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { crew, setCrew } = useCrew(id, 500);
  if (!crew) return null;
  const venue = VENUES.find((v) => v.id === crew.plan.venueId)!;
  const here = crew.arrived.includes(ME);
  return (
    <div className="min-h-dvh pb-6">
      <TopBar back={`/crew/${id}`} title="Meetup" />
      <div className="p-3 space-y-3">
        <Card>
          <div className="font-bold text-[17px]">{venue.name} · {pretty(crew.plan.time)}</div>
          <div className="text-sm text-sub" data-testid="arrived-count">{crew.arrived.length} of {crew.memberIds.length} here</div>
          <MiniMap crew={crew} arrived />
          {!here && (
            <Button className="w-full mt-3 h-11" data-testid="im-here" onClick={async () => setCrew(await post<CrewView>(`/api/crew/${id}/arrive`, { userId: ME }))}>
              📍 I&apos;m here
            </Button>
          )}
          {here && <p className="text-sm text-green-700 mt-3">You&apos;re checked in. Your crew can see you&apos;ve arrived.</p>}
        </Card>
        <Card>
          <h2 className="font-semibold">Who to look for</h2>
          <ul className="mt-2 divide-y divide-line/50">
            {crew.memberIds.filter((m) => m !== ME).map((m) => {
              const p = profileById(m)!;
              const a = crew.arrived.includes(m);
              return (
                <li key={m}>
                  <Link href={`/crew/${id}/people/${m}`} className="py-2 flex items-center gap-3">
                    <Avatar p={p} size={40} ring={a ? "#22c55e" : undefined} />
                    <div className="flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-sub">{crew.whyMember[m]}</div>
                    </div>
                    <span className={`text-xs font-semibold ${a ? "text-green-600" : "text-sub"}`}>{a ? "Here" : "On the way"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="text-xs text-sub text-center px-6">Location is shared only with your crew, only during the meetup window, and stops when the show starts.</p>
      </div>
    </div>
  );
}
