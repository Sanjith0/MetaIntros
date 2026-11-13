"use client";

import { useState } from "react";
import { EyeOff, Hand, MessageCircle } from "lucide-react";
import { AiLabel, Section, chipClass } from "@/components/fb";

type Share = "open" | "need_only" | "private";
interface Fact {
  id: string;
  kind: "interest" | "group" | "music" | "event" | "avoid" | "style";
  text: string;
  share: Share;
}

const KIND: Record<Fact["kind"], string> = { interest: "Likes", group: "Group", music: "Music", event: "Went to", avoid: "Not into", style: "Style" };
const OPTIONS: { value: Share; label: string; hint: string; Icon: typeof EyeOff }[] = [
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
    <Section title="What your Companion will say about you" testId="brief-card">
      <p className="text-body text-muted">
        Your Companion speaks for you to other people&apos;s Companions to find who you&apos;d get along with. You decide what it can share.
      </p>
      {communication && (
        <p className="mt-2 rounded-card bg-wash p-2.5 text-body" data-testid="brief-communication">
          &ldquo;{communication}&rdquo; <AiLabel className="ml-1" />
        </p>
      )}
      <p className="mt-2 text-meta text-muted" data-testid="brief-count">{shared} of {facts.length} shared. Politics, religion, health and sexuality are never included.</p>
      {error && <p className="mt-2 text-meta text-badge" role="alert">{error}</p>}
      <ul className="mt-1 divide-y divide-divider">
        {facts.map((f) => (
          <li key={f.id} className="py-2" data-testid="brief-fact" data-share={f.share}>
            <p className="text-body"><span className="text-muted">{KIND[f.kind]} · </span>{f.text}</p>
            <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label={`Sharing for ${f.text}`}>
              {OPTIONS.map(({ value, label, hint, Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={f.share === value} title={hint} data-testid={`brief-share-${value}`}
                  onClick={() => choose(f, value)} className={chipClass(f.share === value, "flex-1 justify-center gap-1")}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
