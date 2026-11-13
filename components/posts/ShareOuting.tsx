"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ImagePlus, Images, MessageCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { Button, ButtonLink, IconCircle, ListRow, Section, Skeleton, Stack } from "@/components/fb";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";
import type { ShareState } from "@/lib/server/posts";
import { PostComposer } from "./PostComposer";

type Step =
  | { s: "choose" }
  | { s: "own" }
  | { s: "draft"; photoIds: string[]; caption: string; source: string }
  | { s: "posted"; kind: "post" | "story" }
  | { s: "declined" };

interface PostIdea {
  style: "event" | "chat" | "casual";
  photoIds: string[];
  caption: string;
}
type Ideas = { s: "loading" } | { s: "error" } | { s: "ready"; recap: string | null; ideas: PostIdea[]; source: string };

const STYLE_LABEL: Record<PostIdea["style"], string> = { event: "About the event", chat: "From your squad chat", casual: "Short and casual" };

/**
 * "Share the outing", after the event. Post ideas load on their own: a recap of the squad chat and up
 * to 3 drafts (photos + caption) to pick from, edit, then post or discard. Each member can also make
 * their own post, or not post.
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

  const [ideas, setIdeas] = useState<Ideas>({ s: "loading" });
  const asked = useRef(false);
  const loadIdeas = useCallback(async () => {
    setIdeas({ s: "loading" });
    const r = await fetch(`/api/squad/${id}/share/suggest`, { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !Array.isArray(j?.ideas) || !j.ideas.length) return setIdeas({ s: "error" });
    await reload(); // make sure every suggested photo is in the composer's list
    setIdeas({ s: "ready", recap: j.recap ?? null, ideas: j.ideas, source: j.source });
  }, [id, reload]);
  // once the event is over, the ideas load on their own (one Muse call per visit)
  useEffect(() => {
    if (!state.open || asked.current) return;
    asked.current = true;
    void loadIdeas();
  }, [state.open, loadIdeas]);
  const photoUrl = (pid: string) => state.photos.find((p) => p.id === pid)?.url;

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
            <Section testId="share-ideas">
              <h2 className="flex items-center gap-1.5 text-title"><Sparkles size={16} aria-hidden /> Post ideas from your night</h2>
              {ideas.s === "loading" ? (
                <div aria-busy="true">
                  <p className="mt-1 text-meta text-muted">The AI host is reading your squad chat and album</p>
                  <Skeleton className="mt-3 h-10 w-full" />
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="mt-2 h-20 w-full" />)}
                </div>
              ) : ideas.s === "error" ? (
                <div>
                  <p role="alert" className="mt-1 text-body text-muted">Couldn&apos;t get ideas right now.</p>
                  <Button size="sm" className="mt-2" icon={<RotateCcw size={16} />} data-testid="share-ideas-retry" onClick={() => void loadIdeas()}>Try again</Button>
                </div>
              ) : (
                <>
                  {ideas.recap && (
                    <div className="mt-2 rounded-card bg-wash p-3" data-testid="share-recap">
                      <p className="flex items-center gap-1 text-meta font-semibold text-muted"><MessageCircle size={12} aria-hidden /> What your squad talked about</p>
                      <p className="mt-0.5 text-body">{ideas.recap}</p>
                    </div>
                  )}
                  <p className="mt-2 text-meta text-muted">Tap one to edit it. Nothing is posted until you tap Share.</p>
                  <ul className="mt-1 divide-y divide-divider">
                    {ideas.ideas.map((idea, i) => {
                      const cover = idea.photoIds.map(photoUrl).find(Boolean);
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            data-testid="share-idea"
                            data-style={idea.style}
                            className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left"
                            onClick={() => setStep({ s: "draft", photoIds: idea.photoIds, caption: idea.caption, source: ideas.source })}
                          >
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt="" className="h-16 w-16 shrink-0 rounded-card object-cover" />
                            ) : (
                              <IconCircle size={40}><ImagePlus size={18} /></IconCircle>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-meta font-semibold text-muted">
                                {STYLE_LABEL[idea.style] ?? STYLE_LABEL.casual}
                                {idea.photoIds.length > 0 && ` · ${idea.photoIds.length} ${idea.photoIds.length === 1 ? "photo" : "photos"}`}
                              </span>
                              <span className="block text-body">{idea.caption}</span>
                            </span>
                            <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
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
