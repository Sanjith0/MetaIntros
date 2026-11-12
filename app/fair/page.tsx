import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { FairForm } from "@/components/after/FairForm";
import { IconSparkle } from "@/components/icons";
import { FAIR_EVENT_ID, fairGroupSize } from "@/lib/server/after";
import { store } from "@/lib/server/store";

export const metadata: Metadata = { title: "Join at the fair" };
export const dynamic = "force-dynamic";

export default async function FairPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const url = `${origin}/fair?join=1`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#2e1065", light: "#ffffff" } });
  const event = store().events.get(FAIR_EVENT_ID)!;

  return (
    <main className="mx-auto max-w-[560px] px-4 py-6" data-testid="fair-page">
      <div className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-3 bg-gradient-to-br from-[var(--color-pq)] to-[var(--color-pq-2)] px-5 py-4 text-white">
          <IconSparkle size={22} />
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">Party Queue at the fair</div>
            <div className="text-[17px] font-bold">{event.title} · tonight</div>
          </div>
        </div>
        {join ? (
          <div className="p-5">
            <h1 className="text-[20px] font-bold">Join without an account</h1>
            <p className="mb-4 text-[13px] text-[var(--color-ink-2)]">Type a short profile. Everyone who joins here shares the fair's Group, so you'll be matched with other guests tonight.</p>
            <FairForm />
          </div>
        ) : (
          <div className="flex flex-col items-center p-6 text-center">
            <h1 className="text-[22px] font-bold">Scan to find your party</h1>
            <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">Point your phone camera at the code. No app, no login.</p>
            <div className="mt-4 w-[240px] rounded-[12px] p-2 ring-1 ring-[var(--color-divider)]" data-testid="fair-qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="mt-2 break-all text-[12px] text-[var(--color-ink-2)]">{url}</div>
            <div className="mt-1 text-[13px] text-[var(--color-ink-2)]">{fairGroupSize()} guests joined so far</div>
            <Link href="/fair?join=1" data-testid="fair-open-form" className="press mt-4 rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-[15px] font-semibold text-white">
              Join on this device
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
