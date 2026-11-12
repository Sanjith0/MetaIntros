"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";

interface Phone {
  id: string;
  connected: boolean;
  lagMs: number | null;
  sound: string | null;
  vibrate: string | null;
}
interface Status {
  partyStatus: string | null;
  lockedAt: string | null;
  phones: Phone[];
}
interface Card {
  id: string;
  name: string;
  hue: number;
  path: string;
  url: string;
  svg: string;
}

/** Operator view for the real-phone demo: scan, check all five are live,
 *  start, then read how fast each phone showed MATCH FOUND. */
export function PhonesBoard({ cards, lanUrl }: { cards: Card[]; lanUrl: string | null }) {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/phones/status", { cache: "no-store" });
        if (!stop && r.ok) setSt((await r.json()) as Status);
      } catch {}
    };
    void tick();
    const t = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const phone = (id: string) => st?.phones.find((p) => p.id === id);
  const live = st?.phones.filter((p) => p.connected).length ?? 0;
  const acked = st?.phones.filter((p) => p.lagMs !== null) ?? [];
  const slowest = acked.length ? Math.max(...acked.map((p) => p.lagMs!)) : null;

  const start = async (mode: "four" | "all") => {
    setBusy(true);
    await fetch("/api/demo/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-3 rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold" data-testid="phones-live">
            {live} of 5 phones live
          </div>
          <div className="text-[13px] text-[var(--color-ink-2)]">
            {lanUrl ? (
              <>
                Same Wi-Fi, then scan. Phones reach this laptop at <span className="font-mono">{lanUrl}</span> (run <span className="font-mono">npm run dev:lan</span>).
              </>
            ) : (
              "No local network address found. Phones need the laptop's address on the same Wi-Fi."
            )}
          </div>
        </div>
        <button disabled={busy} onClick={() => start("four")} data-testid="phones-queue-four" className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-2 text-[14px] font-semibold disabled:opacity-50">
          Queue Dev, Ana, Kai, Zoe
        </button>
        <button disabled={busy} onClick={() => start("all")} data-testid="phones-run-all" className="press rounded-[6px] bg-[var(--color-pq)] px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-50">
          Run the whole party
        </button>
      </section>

      {slowest !== null && (
        <section
          data-testid="phones-result"
          data-slowest={slowest}
          className={`rounded-[12px] p-4 text-center ${slowest <= 1000 ? "bg-[#e7f6ea] text-[#1d6b2f]" : "bg-[#fdecef] text-[var(--color-badge)]"}`}
        >
          <div className="text-[22px] font-extrabold">
            {acked.length} of 5 showed MATCH FOUND · slowest {slowest} ms after the lock
          </div>
          <div className="text-[13px]">Measured on each phone in server time, then reported back.</div>
        </section>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="phones-grid">
        {cards.map((c) => {
          const p = phone(c.id);
          return (
            <li key={c.id} className="flex flex-col items-center rounded-[12px] bg-white p-3 text-center shadow-[var(--shadow-card)]" data-testid={`phone-${c.id}`} data-connected={p?.connected ? "yes" : "no"}>
              <div className="flex items-center gap-2">
                <Avatar name={c.name} hue={c.hue} size={32} />
                <span className="text-[15px] font-semibold">{c.name.split(" ")[0]}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${p?.connected ? "bg-[var(--color-positive)]" : "bg-[var(--color-btn-2-hover)]"}`} title={p?.connected ? "Live" : "Not connected"} />
              </div>
              <div className="mt-2 w-[150px] rounded-[8px] p-1 ring-1 ring-[var(--color-divider)]" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <a href={c.path} className="mt-1 break-all font-mono text-[10px] text-[var(--color-ink-2)]" data-testid={`phone-link-${c.id}`}>
                {c.url}
              </a>
              <div className="mt-2 min-h-[36px] text-[12px]">
                {p?.lagMs !== null && p?.lagMs !== undefined ? (
                  <span className={`font-semibold ${p.lagMs <= 1000 ? "text-[var(--color-positive)]" : "text-[var(--color-badge)]"}`} data-testid={`phone-lag-${c.id}`}>
                    MATCH FOUND +{p.lagMs} ms
                    <br />
                    <span className="font-normal text-[var(--color-ink-2)]">
                      sound {p.sound} · buzz {p.vibrate}
                    </span>
                  </span>
                ) : (
                  <span className="text-[var(--color-ink-2)]">{p?.connected ? "Live, waiting" : "Scan to join"}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
