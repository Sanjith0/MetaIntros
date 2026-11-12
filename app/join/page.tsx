"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button, Chip, Section, Stack } from "@/components/fb";
import { PrototypeLabel } from "@/components/fb/TopBar";
import { SIGNUP_CHIPS } from "@/lib/graph/vocabulary";
import { AVAIL_SLOTS } from "@/lib/signup";

/** "Under 18" is offered so nobody has to lie to get past the screen; it explains instead of signing up. */
const BANDS = [
  { id: "18-24", label: "18–24" },
  { id: "25+", label: "25+" },
  { id: "under", label: "Under 18" },
] as const;
const GENDERS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "nonbinary", label: "Non-binary" },
  { id: null, label: "Prefer not to say" },
] as const;

/**
 * Demo sign-up for judges' phones. Not a login, asks for no password or account details, and says plainly
 * what it collects and when it's deleted (lib/server/signup.ts makes that true).
 */
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
  const minor = ageBand === "under";
  const basicsOk = name.trim().length >= 2 && ageBand && !minor && gender !== undefined;
  const canWomenOnly = gender === "woman";

  const submit = async (sample: boolean) => {
    setError(null);
    if (minor) return setError("Queue Up is for people 18 and over.");
    if (!basicsOk) return setError("Add your first name, age range and gender first.");
    if (!sample && interests.length < 5) return setError("Pick at least 5 interests.");
    setBusy(true);
    const body = sample
      ? { sample: true, name: name.trim(), ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly }
      : { name: name.trim(), ageBand, gender, womenOnlyParty: canWomenOnly && womenOnly, interests, dislikes, availability: avail };
    const r = await fetch("/api/signup", { method: "POST", body: JSON.stringify(body) }).catch(() => null);
    if (!r?.ok) {
      setBusy(false);
      return setError((await r?.json().catch(() => null))?.error ?? "Something went wrong. Try again.");
    }
    router.push("/events");
    router.refresh();
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-wash pb-10" data-testid="join-page">
      <header className="sticky top-0 z-30 bg-surface">
        <div className="flex h-14 items-center border-b border-divider/60 px-4">
          <h1 className="text-title font-semibold">Join the Queue Up demo</h1>
        </div>
        <PrototypeLabel />
      </header>
      <Stack>
        <Section>
          <p className="text-body">This is a demo sign-up for a hackathon prototype. It isn&apos;t Facebook and isn&apos;t connected to it. There&apos;s no password and no account.</p>
          <ul className="mt-3 space-y-2 text-meta text-muted" data-testid="join-data-promise">
            <li className="flex gap-2"><UserRound size={16} className="mt-px shrink-0 text-ink" aria-hidden /> We collect your first name, age range, gender (optional) and the interests you pick. Age and gender are self-declared.</li>
            <li className="flex gap-2"><ShieldCheck size={16} className="mt-px shrink-0 text-ink" aria-hidden /> If you&apos;re matched, your squad sees your first name and what you have in common.</li>
            <li className="flex gap-2"><Trash2 size={16} className="mt-px shrink-0 text-ink" aria-hidden /> Everything is deleted 24 hours after you sign up, when the demo resets, or right away from your Profile.</li>
          </ul>
        </Section>

        <Section>
          <label htmlFor="join-name" className="text-body font-semibold">First name</label>
          <input
            id="join-name"
            data-testid="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
            maxLength={40}
            className="mt-1.5 h-11 w-full rounded-btn border border-divider bg-surface px-3 text-body outline-none focus-visible:border-accent"
          />
          <p className="mt-4 text-body font-semibold">Age range</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BANDS.map((b) => (
              <Chip key={b.id} on={ageBand === b.id} onClick={() => setAgeBand(b.id)} data-testid={`join-age-${b.id}`}>
                {ageBand === b.id && <Check size={14} aria-hidden />}
                {b.label}
              </Chip>
            ))}
          </div>
          {minor ? (
            <p role="alert" className="mt-1.5 text-meta font-semibold text-badge">Queue Up is for people 18 and over.</p>
          ) : (
            <p className="mt-1.5 text-meta text-muted">You&apos;re only matched with people in your own age range.</p>
          )}
          <p className="mt-4 text-body font-semibold">Gender</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip key={String(g.id)} on={gender === g.id} onClick={() => setGender(g.id)} data-testid={`join-gender-${g.id ?? "none"}`}>
                {gender === g.id && <Check size={14} aria-hidden />}
                {g.label}
              </Chip>
            ))}
          </div>
          {canWomenOnly && (
            <label className="mt-3 flex items-center gap-2 text-body">
              <input type="checkbox" data-testid="join-women-only" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="h-5 w-5 accent-accent" />
              Only match me into women-only squads
            </label>
          )}
        </Section>

        <Section>
          <Button variant="primary" size="lg" block disabled={busy} onClick={() => submit(true)} data-testid="join-sample">
            {busy ? "Setting up…" : "Start with sample interests"}
          </Button>
          <p className="mt-2 text-center text-meta text-muted">Fastest: we give you a sample set of interests under your first name.</p>
        </Section>

        <Section title="Or pick your own">
          <p className="text-body font-semibold">Things you&apos;re into <span className="font-normal text-muted">({interests.length} of 5+)</span></p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SIGNUP_CHIPS.map((c) => (
              <Chip key={c.tag} on={interests.includes(c.tag)} data-testid={`join-interest-${c.tag}`} onClick={() => { toggle(interests, setInterests, c.tag); setDislikes((d) => d.filter((x) => x !== c.tag)); }}>
                {c.label}
              </Chip>
            ))}
          </div>
          <p className="mt-4 text-body font-semibold">Not for you <span className="font-normal text-muted">(optional)</span></p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SIGNUP_CHIPS.filter((c) => !interests.includes(c.tag)).map((c) => (
              <Chip key={c.tag} on={dislikes.includes(c.tag)} onClick={() => toggle(dislikes, setDislikes, c.tag)}>{c.label}</Chip>
            ))}
          </div>
          <p className="mt-4 text-body font-semibold">When are you free this weekend?</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {AVAIL_SLOTS.map((s) => (
              <Chip key={s.id} on={avail.includes(s.id)} onClick={() => toggle(avail, setAvail, s.id)} data-testid={`join-slot-${s.id}`}>{s.label}</Chip>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-meta font-semibold text-badge" data-testid="join-error">{error}</p>}
          <Button size="lg" block className="mt-4" disabled={busy} onClick={() => submit(false)} data-testid="join-submit">
            {busy ? "Setting up…" : "Join with these"}
          </Button>
        </Section>
      </Stack>
    </main>
  );
}
