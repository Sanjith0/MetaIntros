import type { Metadata } from "next";
import Link from "next/link";
import { RunItBack } from "@/components/after/RunItBack";
import { runItBackView } from "@/lib/server/after";
import { partyForViewer, person } from "@/lib/server/social";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Run it back" };
export const dynamic = "force-dynamic";

export default async function RunItBackPage() {
  const viewer = await currentViewerId();
  const party = partyForViewer(viewer);
  const plan = party?.planId ? store().plans.get(party.planId) : undefined;
  const view = party ? runItBackView(party.id, viewer) : null;

  if (!party || party.status !== "locked" || !view) {
    return (
      <main className="mx-auto max-w-[560px] px-4 py-10 text-center" data-testid="runitback-empty">
        <h1 className="text-[20px] font-bold">Nothing to run back yet</h1>
        <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">After a night out with your party, you can privately pick who you'd see again.</p>
        <Link href="/events" className="mt-4 inline-block text-[15px] font-semibold text-[var(--color-link)]">
          Browse events
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 py-6">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Run it back</div>
        <h1 className="text-[24px] font-bold leading-tight">How was {plan?.title ?? "your night"}?</h1>
      </div>
      <RunItBack key={viewer} partyId={party.id} viewerId={viewer} members={party.memberIds.map(person)} initial={view} />
    </main>
  );
}
