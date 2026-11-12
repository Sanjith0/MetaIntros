import type { Metadata } from "next";
import Link from "next/link";
import { DoorClient } from "@/components/door/DoorClient";
import { clock12 } from "@/lib/format";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { memberPartyViewForViewer } from "@/lib/server/views";

export const metadata: Metadata = { title: "At the door" };
export const dynamic = "force-dynamic";

export default async function DoorPage() {
  const viewer = await currentViewerId();
  const v = memberPartyViewForViewer(viewer);
  const s = store();
  const plan = v?.party.planId ? s.plans.get(v.party.planId) : undefined;

  if (!v || v.party.status !== "locked" || !plan) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10 text-center" data-testid="door-empty">
        <h1 className="text-[20px] font-bold">No plan yet</h1>
        <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">The door opens once your party has a locked plan.</p>
        <Link href="/party" className="mt-4 inline-block text-[15px] font-semibold text-[var(--color-link)]">
          Go to your party
        </Link>
      </main>
    );
  }

  const lastSpotted = [...s.spotted].reverse().find((x) => x.viewerId === viewer && x.partyId === v.party.id && x.subjectId);

  return (
    <main className="mx-auto max-w-[480px] px-4 py-5" data-testid="door-page">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · At the door</div>
        <h1 className="text-[22px] font-bold leading-tight">{plan.title}</h1>
        <div className="text-[15px] text-[var(--color-ink-2)]">
          {plan.venueName} · from {clock12(plan.start)}
        </div>
      </div>
      <DoorClient
        partyId={v.party.id}
        viewerId={viewer}
        members={v.members.map((m) => ({ id: m.id, name: m.name, firstName: m.firstName, hue: m.hue, arrived: m.arrived }))}
        cards={v.cards}
        initialSpotted={lastSpotted?.subjectId ?? null}
      />
    </main>
  );
}
