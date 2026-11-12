"use client";

import { useState } from "react";
import type { FriendMessage } from "@/lib/server/tellfriend";

/** Copy or share a message for a friend outside the app. The app sends nothing. */
export function TellFriend({ m }: { m: FriendMessage }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const opt = m.options[i]!;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(opt.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) await navigator.share({ text: opt.text }).catch(() => {});
    else await copy();
  };
  return (
    <section className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid="tell-friend">
      <h2 className="text-[17px] font-bold">Tell a friend where you&apos;ll be</h2>
      <p className="text-[13px] text-[var(--color-ink-2)]">For someone outside the app. It doesn&apos;t name the others, and Party Queue sends nothing: you copy or share it.</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="When you'll check in">
        <span className="text-[13px] font-semibold">I&apos;ll check in by</span>
        {m.options.map((o, k) => (
          <button
            key={o.after}
            onClick={() => {
              setI(k);
              setCopied(false);
            }}
            aria-pressed={i === k}
            className={`press rounded-full px-2.5 py-1 text-[13px] font-semibold ${i === k ? "bg-[var(--color-pq)] text-white" : "bg-[var(--color-btn-2)]"}`}
          >
            {o.checkInBy}
          </button>
        ))}
      </div>
      <p className="mt-2 rounded-[8px] bg-[var(--color-wash)] p-3 text-[15px]" data-testid="tell-friend-text">
        {opt.text}
      </p>
      <div className="mt-2 flex gap-2">
        <button onClick={share} className="press rounded-[6px] bg-[var(--color-pq)] px-3 py-1.5 text-[14px] font-semibold text-white">
          Share
        </button>
        <button onClick={copy} data-testid="tell-friend-copy" className="press rounded-[6px] bg-[var(--color-btn-2)] px-3 py-1.5 text-[14px] font-semibold">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
