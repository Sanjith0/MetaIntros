import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { FairHost } from "@/components/fair/FairHost";
import { flag } from "@/lib/flags";
import { FAIR_EVENT_ID } from "@/lib/server/after";
import { lanAddress } from "@/lib/server/phones";
import { store } from "@/lib/server/store";

export const metadata: Metadata = { title: "Fair host" };
export const dynamic = "force-dynamic";

export default async function FairHostPage() {
  if (!flag("FAIR_HOST")) notFound();
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":").pop() : "80";
  const lan = lanAddress();
  const joinUrl = `${lan ? `http://${lan}:${port}` : `http://${host}`}/fair?join=1`;
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#2e1065", light: "#ffffff" } });
  const event = store().events.get(FAIR_EVENT_ID)!;
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-5" data-testid="fair-host">
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Fair host</div>
        <h1 className="text-[24px] font-bold">{event.title}: live</h1>
      </div>
      <FairHost qrSvg={qrSvg} joinUrl={joinUrl} />
    </main>
  );
}
