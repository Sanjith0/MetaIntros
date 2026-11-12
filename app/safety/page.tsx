import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCheck } from "@/components/icons";
import { LeaveParty } from "@/components/party/LeaveParty";
import { SafetyPeople } from "@/components/safety/SafetyPeople";
import { ForgetNight } from "@/components/safety/ForgetNight";
import { forgetAt, isForgotten, keepsNight, pacificLabel, wasAutoForgotten } from "@/lib/server/forget";
import { flag } from "@/lib/flags";
import { queueStatus } from "@/lib/server/queue";
import { partyPeople } from "@/lib/server/safety";
import { partyForViewer } from "@/lib/server/social";
import { profile, store } from "@/lib/server/store";
import { currentViewerId } from "@/lib/server/viewer";
import { autoForgetDue } from "@/lib/server/forget";

export const metadata: Metadata = { title: "Safety" };
export const dynamic = "force-dynamic";

const ENFORCED = [
  ["18 and over", "Everyone in Party Queue is 18 or older. Younger people can't join the queue."],
  ["Public places only", "Every plan is checked by code: a private venue never reaches the agents as an option."],
  ["Your rules hold", "End time, budget, no drink minimum: code checks every plan against them after the model, and wins."],
  ["Blocks hold", "Nobody you blocked, or who blocked you, can land in your party."],
  ["Who's in your party", "Women-only and never-the-only-woman settings are checked by code when a party forms."],
  ["Nothing from faces", "The door only ever names someone from your own party who opted in. No photos, no looks, no guesses."],
] as const;

export default async function SafetyPage() {
  if (!flag("SAFETY_PAGE")) notFound();
  autoForgetDue(); // F43: a night that is over forgets itself
  const viewer = await currentViewerId();
  const me = profile(viewer);
  const people = partyPeople(viewer).map((id) => {
    const p = profile(id);
    return { id, name: p.name, hue: p.avatarHue };
  });
  const blockedOutsideParties = me.blocks.filter((id) => !people.some((p) => p.id === id));
  const party = partyForViewer(viewer);
  const q = queueStatus(viewer);

  return (
    <main className="mx-auto max-w-[720px] space-y-4 px-4 py-5" data-testid="safety-page">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Safety</div>
        <h1 className="text-[24px] font-bold">You're in control</h1>
        <p className="text-[14px] text-[var(--color-ink-2)]">If you're in danger, call 911. For anything else, this page has you covered.</p>
      </div>

      <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="safety-enforced">
        <h2 className="text-[17px] font-bold">What code always enforces</h2>
        <ul className="mt-2 space-y-2">
          {ENFORCED.map(([title, body]) => (
            <li key={title} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-positive)] text-white">
                <IconCheck size={13} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="block text-[13px] text-[var(--color-ink-2)]">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-[17px] font-bold">Leave</h2>
        {party && party.status !== "locked" && party.status !== "failed" ? (
          <div className="mt-2" data-testid="safety-leave">
            <p className="mb-2 text-[13px] text-[var(--color-ink-2)]">Your party hasn't set a plan yet. You can leave now; the others aren't told who left.</p>
            <LeaveParty partyId={party.id} />
          </div>
        ) : q?.entry.status === "waiting" ? (
          <p className="mt-2 text-[14px]">
            You're in the queue. <Link href="/queue" className="font-semibold text-[var(--color-link)]">Leave the queue</Link> from the queue sheet.
          </p>
        ) : party?.status === "locked" ? (
          <p className="mt-2 text-[14px] text-[var(--color-ink-2)]">Your plan is set. You can skip it any time: you don't owe anyone a reason. Tell your party in the chat if you like.</p>
        ) : (
          <p className="mt-2 text-[14px] text-[var(--color-ink-2)]">You're not in a party or the queue right now.</p>
        )}
      </section>

      {flag("FORGET_ME") && party && (party.status === "locked" || party.status === "failed") && (
        <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="safety-forget">
          <h2 className="text-[17px] font-bold">Forget my night</h2>
          <ForgetNight
            partyId={party.id}
            title={party.planId ? (store().plans.get(party.planId)?.title ?? "this party") : "this party"}
            done={isForgotten(party.id, viewer)}
            auto={
              flag("AUTO_FORGET") && forgetAt(party.id)
                ? { at: pacificLabel(forgetAt(party.id)!), keep: keepsNight(party.id, viewer), happened: wasAutoForgotten(party.id, viewer) }
                : null
            }
          />
        </section>
      )}

      <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-[17px] font-bold">People from your parties</h2>
        <p className="mb-2 text-[13px] text-[var(--color-ink-2)]">Block someone and they'll never land in your party. Report someone and a person reviews it; they aren't told.</p>
        <SafetyPeople people={people} blocked={me.blocks} />
        {blockedOutsideParties.length > 0 && <p className="mt-2 text-[12px] text-[var(--color-ink-2)]">You've also blocked {blockedOutsideParties.length} other {blockedOutsideParties.length === 1 ? "person" : "people"}.</p>}
      </section>
    </main>
  );
}
