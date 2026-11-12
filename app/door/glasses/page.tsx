import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassesView } from "@/components/door/GlassesView";
import { FRAME_SOURCES, frameSource } from "@/lib/door/source";
import { flag } from "@/lib/flags";
import { store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { memberPartyViewForViewer } from "@/lib/server/views";

export const metadata: Metadata = { title: "Glasses" };
export const dynamic = "force-dynamic";

export default async function GlassesPage() {
  if (!flag("GLASSES_VIEW")) notFound();
  const viewer = await currentViewerId();
  const v = memberPartyViewForViewer(viewer);
  if (!v || v.party.status !== "locked") {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10 text-center">
        <h1 className="text-[20px] font-bold">No plan yet</h1>
        <Link href="/party" className="mt-2 inline-block text-[15px] font-semibold text-[var(--color-link)]">
          Go to your party
        </Link>
      </main>
    );
  }
  const last = [...store().spotted].reverse().find((x) => x.viewerId === viewer && x.partyId === v.party.id && x.subjectId);
  return (
    <GlassesView
      partyId={v.party.id}
      viewerId={viewer}
      members={v.members.map((m) => ({ id: m.id, firstName: m.firstName }))}
      cards={v.cards}
      sourceLabel={FRAME_SOURCES.find((f) => f.id === frameSource())!.label}
      initial={last?.subjectId ? { id: last.subjectId, method: last.method } : null}
    />
  );
}
