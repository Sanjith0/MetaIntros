"use client";

import { useState } from "react";

interface FactInput {
  tag: string;
  text: string;
  ask: string;
  approved: boolean;
}

const EMPTY: FactInput = { tag: "", text: "", ask: "", approved: true };

/** Typed profile for the fair. No photo, no login. */
export function FairForm() {
  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"woman" | "man" | "nonbinary">("nonbinary");
  const [pronouns, setPronouns] = useState("");
  const [sentence, setSentence] = useState("");
  const [facts, setFacts] = useState<FactInput[]>([{ ...EMPTY }, { ...EMPTY }]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setFact = (i: number, patch: Partial<FactInput>) => setFacts((fs) => fs.map((f, j) => (i === j ? { ...f, ...patch } : f)));
  const ready = firstName.trim() && age && sentence.trim().length >= 3 && consent;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/fair/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName, age: Number(age), gender, pronouns, sentence, facts: facts.filter((f) => f.text.trim()), consent }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not join.");
      return;
    }
    window.location.href = "/queue";
  };

  const input = "h-10 w-full rounded-[6px] border border-[var(--color-divider)] px-3 text-[15px] outline-none focus:border-[var(--color-pq)]";

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="fair-form">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-[13px] font-semibold sm:col-span-1">
          First name
          <input data-testid="fair-name" className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} />
        </label>
        <label className="text-[13px] font-semibold">
          Age
          <input data-testid="fair-age" className={input} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </label>
        <label className="text-[13px] font-semibold">
          I am
          <select className={input} value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
            <option value="woman">a woman</option>
            <option value="man">a man</option>
            <option value="nonbinary">nonbinary</option>
          </select>
        </label>
        <label className="text-[13px] font-semibold">
          Pronouns
          <input className={input} value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="optional" maxLength={30} />
        </label>
      </div>

      <label className="block text-[13px] font-semibold">
        Your night in one sentence
        <input data-testid="fair-sentence" className={input} value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder="games or anything chill, home by ten" maxLength={280} />
      </label>

      <div>
        <div className="text-[13px] font-semibold">A couple of things about you</div>
        <div className="text-[12px] text-[var(--color-ink-2)]">Only what you tick can be shared with your party.</div>
        {facts.map((f, i) => (
          <div key={i} className="mt-2 grid grid-cols-1 gap-2 rounded-[8px] bg-[var(--color-wash)] p-3 sm:grid-cols-[120px_1fr]">
            <input data-testid={`fair-tag-${i}`} className={input} value={f.tag} onChange={(e) => setFact(i, { tag: e.target.value })} placeholder="topic" maxLength={40} />
            <input data-testid={`fair-text-${i}`} className={input} value={f.text} onChange={(e) => setFact(i, { text: e.target.value })} placeholder="e.g. Plays in a ukulele band" maxLength={120} />
            <input className={`${input} sm:col-span-2`} value={f.ask} onChange={(e) => setFact(i, { ask: e.target.value })} placeholder="Something people can ask you about it (optional)" maxLength={120} />
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
              <input type="checkbox" checked={f.approved} onChange={(e) => setFact(i, { approved: e.target.checked })} className="accent-[var(--color-pq)]" />
              OK to share with my party
            </label>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-2 rounded-[8px] border border-[var(--color-divider)] p-3 text-[13px]">
        <input type="checkbox" data-testid="fair-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-pq)]" />
        <span>
          I agree to Party Queue using what I typed here to find me a party of five tonight. No photo is taken, nothing is inferred from my face, and this profile is deleted when the demo resets.
        </span>
      </label>

      {error && <div className="rounded-[6px] bg-[#fdecef] px-3 py-2 text-[13px] text-[var(--color-badge)]">{error}</div>}

      <button data-testid="fair-join" disabled={!ready || busy} className="press h-11 w-full rounded-[6px] bg-[var(--color-pq)] text-[15px] font-semibold text-white disabled:opacity-40">
        {busy ? "Joining…" : "Join the queue"}
      </button>
    </form>
  );
}
