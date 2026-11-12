"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { SIGNUP_CHIPS } from "@/lib/graph/vocabulary";
import { AVAIL_SLOTS } from "@/lib/signup";

const BANDS = ["13-15", "16-17", "18-24", "25+"] as const;
const GENDERS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "nonbinary", label: "Non-binary" },
  { id: null, label: "Prefer not to say" },
] as const;

function Chip({ on, onClick, children, testId, tone = "blue" }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string; tone?: "blue" | "red" }) {
  const onCls = tone === "blue" ? "border-fb-blue bg-[#e7f3ff] text-fb-blue" : "border-[#e41e3f] bg-[#ffebee] text-[#e41e3f]";
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? onCls : "border-fb-divider bg-white"}`}>
      {on && <Check size={13} className="mr-1 inline" />}
      {children}
    </button>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null | undefined>(undefined);
  const [womenOnly, setWomenOnly] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [avail, setAvail] = useState<string[]>(["sat-pm", "sat-eve"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (xs: string[], set: (v: string[]) => void, x: string) => set(xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const basicsOk = name.trim().length >= 2 && ageBand && gender !== undefined;
  const canWomenOnly = gender === "woman";

  const submit = async (sample: boolean) => {
    setError(null);
    if (!basicsOk) return setError("Add your name, age range and gender first.");
    if (!sample && interests.length < 5) return setError("Pick at least 5 interests.");
    setBusy(true);
    const body = sample
      ? { sample: true, name, ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly }
      : { name, ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly, interests, dislikes, availability: avail };
    const r = await fetch("/api/signup", { method: "POST", body: JSON.stringify(body) });
    if (!r.ok) {
      setBusy(false);
      return setError((await r.json()).error ?? "Something went wrong");
    }
    router.push("/events");
    router.refresh();
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-4 pb-10 pt-6" data-testid="join-page">
      <h1 className="text-[34px] font-bold tracking-tight text-fb-blue" style={{ letterSpacing: "-0.04em" }}>facebook</h1>
      <p className="mt-1 text-sm text-fb-muted">Demo sign-up · no real Facebook data is used</p>

      <section className="mt-5 space-y-3">
        <input data-testid="join-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first and last name"
          className="w-full rounded-lg border border-fb-divider px-3 py-3 text-base outline-none focus:border-fb-blue" />
        <div>
          <p className="mb-1 text-sm font-semibold">Age range</p>
          <div className="flex flex-wrap gap-2">
            {BANDS.map((b) => <Chip key={b} on={ageBand === b} onClick={() => setAgeBand(b)} testId={`join-age-${b}`}>{b}</Chip>)}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-fb-muted"><ShieldCheck size={12} /> You&apos;ll only ever be matched with people in your own age range.</p>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Gender</p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => <Chip key={String(g.id)} on={gender === g.id} onClick={() => setGender(g.id)} testId={`join-gender-${g.id ?? "none"}`}>{g.label}</Chip>)}
          </div>
          {canWomenOnly && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" data-testid="join-women-only" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} />
              Only match me into women-only squads
            </label>
          )}
        </div>
      </section>

      <button type="button" disabled={busy} onClick={() => submit(true)} data-testid="join-sample"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-queue-glow py-3 font-semibold text-queue-glow">
        <Sparkles size={18} /> Use a sample Facebook profile
      </button>
      <p className="my-4 text-center text-xs uppercase tracking-wider text-fb-muted">or pick your own</p>

      <section>
        <p className="mb-1 text-sm font-semibold">Things you&apos;re into <span className="font-normal text-fb-muted">({interests.length}/5+)</span></p>
        <div className="flex flex-wrap gap-2">
          {SIGNUP_CHIPS.map((c) => (
            <Chip key={c.tag} on={interests.includes(c.tag)} testId={`join-interest-${c.tag}`}
              onClick={() => { toggle(interests, setInterests, c.tag); setDislikes((d) => d.filter((x) => x !== c.tag)); }}>
              {c.label}
            </Chip>
          ))}
        </div>
      </section>
      <section className="mt-4">
        <p className="mb-1 text-sm font-semibold">Not for you <span className="font-normal text-fb-muted">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {SIGNUP_CHIPS.filter((c) => !interests.includes(c.tag)).map((c) => (
            <Chip key={c.tag} tone="red" on={dislikes.includes(c.tag)} onClick={() => toggle(dislikes, setDislikes, c.tag)}>{c.label}</Chip>
          ))}
        </div>
      </section>
      <section className="mt-4">
        <p className="mb-1 text-sm font-semibold">When are you free this weekend?</p>
        <div className="flex flex-wrap gap-2">
          {AVAIL_SLOTS.map((s) => <Chip key={s.id} on={avail.includes(s.id)} onClick={() => toggle(avail, setAvail, s.id)} testId={`join-slot-${s.id}`}>{s.label}</Chip>)}
        </div>
      </section>

      {error && <p className="mt-4 rounded-lg bg-[#ffebee] p-2 text-sm text-[#e41e3f]" data-testid="join-error">{error}</p>}
      <button type="button" disabled={busy} onClick={() => submit(false)} data-testid="join-submit"
        className="mt-5 w-full rounded-xl bg-fb-blue py-3.5 text-lg font-bold text-white disabled:opacity-60">
        {busy ? "Setting up…" : "Join"}
      </button>
    </main>
  );
}
