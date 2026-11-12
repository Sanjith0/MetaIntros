"use client";

import { useState } from "react";
import { Bot, EyeOff, Hand, MessageCircle } from "lucide-react";

type Share = "open" | "need_only" | "private";
interface Fact {
  id: string;
  kind: "interest" | "group" | "music" | "event" | "avoid" | "style";
  text: string;
  share: Share;
}

const KIND: Record<Fact["kind"], string> = { interest: "Likes", group: "Group", music: "Music", event: "Went to", avoid: "Not into", style: "Style" };
const OPTIONS: { value: Share; label: string; hint: string; Icon: typeof Bot }[] = [
  { value: "open", label: "Share", hint: "Your Companion can mention this", Icon: MessageCircle },
  { value: "need_only", label: "Only as a need", hint: "It can ask for what you need, without saying why", Icon: Hand },
  { value: "private", label: "Keep private", hint: "It never mentions this", Icon: EyeOff },
];

/** "What your Companion will say about you": the user decides, fact by fact, what their Companion agent may share. */
export function BriefCard({ initial, communication }: { initial: Fact[]; communication: string }) {
  const [facts, setFacts] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function choose(f: Fact, share: Share) {
    if (f.share === share) return;
    const before = facts;
    setFacts((fs) => fs.map((x) => (x.id === f.id ? { ...x, share } : x)));
    setError(null);
    const ok = await fetch("/api/companion/brief/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factId: f.id, share }) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) {
      setFacts(before);
      setError("Couldn't save that. Try again.");
    }
  }

  const shared = facts.filter((f) => f.share === "open").length;
  return (
    <section className="mt-2 bg-white p-4" data-testid="brief-card">
      <h2 className="flex items-center gap-2 font-semibold"><Bot size={18} className="text-queue-glow" /> What your Companion will say about you</h2>
      <p className="mt-1 text-sm text-fb-muted">
        In Queue Up, your Companion AI speaks for you to other people&apos;s Companions to find who you&apos;d get along with. You decide what it can share.
      </p>
      {communication && <p className="mt-2 rounded-xl bg-fb-bg p-2 text-sm italic" data-testid="brief-communication">&ldquo;{communication}&rdquo;</p>}
      <p className="mt-2 text-xs text-fb-muted" data-testid="brief-count">{shared} of {facts.length} shared · politics, religion, health &amp; sexuality are never included</p>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
      <ul className="mt-2 divide-y divide-[#e4e6eb]">
        {facts.map((f) => (
          <li key={f.id} className="py-2" data-testid="brief-fact" data-share={f.share}>
            <p className="text-sm"><span className="text-fb-muted">{KIND[f.kind]} · </span>{f.text}</p>
            <div className="mt-1 flex gap-1" role="radiogroup" aria-label={`Sharing for ${f.text}`}>
              {OPTIONS.map(({ value, label, hint, Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={f.share === value} title={hint} data-testid={`brief-share-${value}`}
                  onClick={() => choose(f, value)}
                  className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold ${f.share === value ? "bg-fb-blue text-white" : "bg-fb-bg text-fb-muted"}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
