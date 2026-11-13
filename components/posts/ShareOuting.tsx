"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Check, ChevronRight, ImagePlus, Images, Sparkles, X } from "lucide-react";
import { ButtonLink, IconCircle, ListRow, Section, Skeleton, Stack } from "@/components/fb";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";
import type { ShareState } from "@/lib/server/posts";
import { PostComposer } from "./PostComposer";

type Step =
  | { s: "choose" }
  | { s: "own" }
  | { s: "thinking" }
  | { s: "draft"; photoIds: string[]; caption: string; source: string }
  | { s: "posted"; kind: "post" | "story" }
  | { s: "declined" };

/**
 * "Share the outing", after the event. Each member chooses for themselves: make their own post, let
 * the AI host suggest one (a draft they edit, then post or discard), or don't post.
 */
export function ShareOuting({ initial }: { initial: ShareState }) {
  const id = initial.partyId;
  const [state, setState] = useState(initial);
  const [step, setStep] = useState<Step>({ s: "choose" });
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(
    () =>
      fetch(`/api/squad/${id}/share`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setState(d))
        .catch(() => {}),
    [id],
  );
  // squadmates may add photos or change consent while you're here
  useLiveEvents(["album"], (_t, d) => {
    if (!d || (d as { partyId?: string }).partyId === id) reload();
  }, reload);

  const album = { partyId: id, eventTitle: state.eventTitle, photos: state.photos };

  const suggest = async () => {
    setError(null);
    setStep({ s: "thinking" });
    const r = await fetch(`/api/squad/${id}/share/suggest`, { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.draft) {
      setStep({ s: "choose" });
      return setError("Couldn't get a suggestion right now. Try again or make your own post.");
    }
    await reload(); // make sure every suggested photo is in the composer's list
    setStep({ s: "draft", ...j.draft });
  };
  const decline = async () => {
    setError(null);
    const r = await fetch(`/api/squad/${id}/share`, { method: "POST", body: JSON.stringify({ choice: "none" }) }).catch(() => null);
    if (!r?.ok) return setError("Couldn't save that. Try again.");
    setState((s) => ({ ...s, choice: "none" }));
    setStep({ s: "declined" });
  };
  const posted = (r: { kind: "post" | "story" }) => {
    setState((s) => ({ ...s, choice: step.s === "draft" ? "ai" : "own" }));
    setStep({ s: "posted", kind: r.kind });
  };

  return (
    <div data-testid="share-outing" data-step={step.s}>
      <TopBar back={`/squad/${id}`} title="Share the outing" />
      <Stack>
        {!state.open ? (
          <Section>
            <h1 className="text-headline font-bold">After {state.eventTitle}</h1>
            <p className="mt-1 text-body text-muted">Sharing opens once the event is over. Until then, add photos to your squad album.</p>
            <ButtonLink href={`/squad/${id}/album`} variant="primary" block className="mt-3" icon={<Images size={18} />}>Open squad album</ButtonLink>
          </Section>
        ) : step.s === "choose" ? (
          <>
            <Section>
              <h1 className="text-headline font-bold">How do you want to share {state.eventTitle}?</h1>
              <p className="mt-1 text-body text-muted">It&apos;s up to you. Your squadmates choose for themselves, and nobody is told what you pick.</p>
              {state.choice && (
                <p className="mt-2 rounded-card bg-wash p-3 text-meta text-muted" data-testid="share-already">
                  {state.choice === "none" ? "You chose not to post. You can still share something." : "You already shared a post. You can share another."}
                </p>
              )}
            </Section>
            <Section flush>
              <ListRow
                onClick={() => setStep({ s: "own" })}
                testId="share-own"
                leading={<IconCircle><ImagePlus size={18} /></IconCircle>}
                title="Make my own post"
                subtitle="Pick photos from the squad album and write a caption"
                trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
              />
              <ListRow
                onClick={suggest}
                testId="share-ai"
                leading={<IconCircle><Sparkles size={18} /></IconCircle>}
                title="Let AI suggest a post"
                subtitle="The AI host picks up to 4 photos and drafts a caption. You review it first."
                trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
              />
              <ListRow
                onClick={decline}
                testId="share-none"
                leading={<IconCircle><X size={18} /></IconCircle>}
                title="Don't post"
                subtitle="We won't ask again"
              />
              {error && <p role="alert" className="px-4 pb-2 text-meta text-badge">{error}</p>}
            </Section>
            <Section flush>
              <ListRow href={`/squad/${id}/album`} leading={<IconCircle><Images size={18} /></IconCircle>} title="Squad album" subtitle={`${state.photos.length} ${state.photos.length === 1 ? "photo" : "photos"} you can use`} trailing={<ChevronRight size={20} className="text-muted" aria-hidden />} />
            </Section>
          </>
        ) : step.s === "thinking" ? (
          <Section testId="share-thinking">
            <p className="flex items-center gap-1 text-meta text-muted"><Sparkles size={12} aria-hidden /> The AI host is drafting a post</p>
            <div className="mt-3 flex gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-20" />)}
            </div>
            <Skeleton className="mt-3 h-16 w-full" />
          </Section>
        ) : step.s === "own" || step.s === "draft" ? (
          <Section>
            <h1 className="mb-3 text-headline font-bold">{step.s === "draft" ? "Suggested post" : "Your post"}</h1>
            <PostComposer
              key={step.s}
              albums={[album]}
              initialPartyId={id}
              bindParty
              initial={step.s === "draft" ? { photoIds: step.photoIds, caption: step.caption } : undefined}
              ai={step.s === "draft" ? { source: step.source, caption: step.caption } : null}
              onPosted={posted}
              onCancel={() => setStep({ s: "choose" })}
              cancelLabel={step.s === "draft" ? "Discard" : "Cancel"}
            />
          </Section>
        ) : step.s === "posted" ? (
          <Section testId="share-done">
            <div className="flex items-center gap-3">
              <IconCircle tone="positive" size={40}><Check size={20} /></IconCircle>
              <div>
                <p className="text-body font-semibold">{step.kind === "story" ? "Added to your story" : "Posted"}</p>
                <p className="text-meta text-muted">{step.kind === "story" ? "Your story disappears in 24 hours." : "It's on Home now."}</p>
              </div>
            </div>
            <ButtonLink href="/home" variant="primary" block className="mt-3" data-testid="share-see-home">See it on Home</ButtonLink>
            <Link href={`/squad/${id}`} className="mt-3 block text-center text-body text-link">Back to squad info</Link>
          </Section>
        ) : (
          <Section testId="share-declined">
            <p className="text-body font-semibold">Got it. You won&apos;t be asked again.</p>
            <p className="mt-1 text-meta text-muted">The squad album stays here if you change your mind.</p>
            <div className="mt-3 flex gap-2">
              <ButtonLink href={`/squad/${id}`} block>Back to squad info</ButtonLink>
              <ButtonLink href={`/squad/${id}/album`} block>Squad album</ButtonLink>
            </div>
          </Section>
        )}
      </Stack>
    </div>
  );
}
