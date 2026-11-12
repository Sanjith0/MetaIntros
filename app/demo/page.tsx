import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPanel } from "@/components/demo/DemoPanel";
import { Preflight } from "@/components/demo/Preflight";
import { DEMO_IDS } from "@/fixtures";
import { flag } from "@/lib/flags";
import { profile } from "@/lib/server/store";

export const metadata: Metadata = { title: "Demo controls" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  if (!flag("DEMO_PANEL")) notFound();
  const people = DEMO_IDS.map((id) => {
    const p = profile(id);
    return { id, name: p.name, hue: p.avatarHue };
  });
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5" data-testid="demo-page">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Demo controls</div>
        <h1 className="text-[24px] font-bold">Run the five-minute demo</h1>
        <p className="text-[15px] text-[var(--color-ink-2)]">For whoever is presenting. Seeded, fictional people only.</p>
      </div>
      {flag("PREFLIGHT") && <Preflight />}
      <DemoPanel people={people} />
    </main>
  );
}
