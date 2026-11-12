import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PhonesBoard } from "@/components/phones/PhonesBoard";
import { DEMO_IDS } from "@/fixtures";
import { flag } from "@/lib/flags";
import { lanAddress } from "@/lib/server/phones";
import { profile } from "@/lib/server/store";

export const metadata: Metadata = { title: "Real phones" };
export const dynamic = "force-dynamic";

export default async function PhonesPage() {
  if (!flag("REAL_PHONES")) notFound();
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":").pop() : "80";
  const lan = lanAddress();
  const base = lan ? `http://${lan}:${port}` : `http://${host}`;
  const cards = await Promise.all(
    DEMO_IDS.map(async (id) => {
      const p = profile(id);
      const url = `${base}/join/${id}`;
      return { id, name: p.name, hue: p.avatarHue, path: `/join/${id}`, url, svg: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#2e1065", light: "#ffffff" } }) };
    }),
  );
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5" data-testid="phones-page">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Real phones</div>
        <h1 className="text-[24px] font-bold">Five phones, one MATCH FOUND</h1>
        <p className="text-[15px] text-[var(--color-ink-2)]">Each person scans their own code. Tap anywhere once on each phone so it can play sound.</p>
      </div>
      <PhonesBoard cards={cards} lanUrl={lan ? base : null} />
    </main>
  );
}
