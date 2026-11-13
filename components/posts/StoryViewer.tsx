"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { Avatar, cn } from "@/components/fb";
import { CaptionSource } from "./CaptionSource";

export interface StoryItem {
  id: string;
  caption: string;
  photos: { id: string; url: string }[];
  ago: string;
  event: { title: string } | null;
  audience: "friends" | "only_me";
  aiSource: string | null;
  aiEdited: boolean;
}
export interface StoryGroupItem {
  author: { id: string; name: string; avatarColor: string; isSimulated: boolean; isLive: boolean };
  mine: boolean;
  stories: StoryItem[];
}

interface Frame { story: StoryItem; photo: { id: string; url: string } | null }
/** One frame per photo (a text-only story is one frame). */
export const framesOf = (g: StoryGroupItem): Frame[] => g.stories.flatMap((s): Frame[] => (s.photos.length ? s.photos.map((photo) => ({ story: s, photo })) : [{ story: s, photo: null }]));

/**
 * Full-screen story viewer: tap the right side (or anywhere but the left third) to advance, the left
 * third to go back; X or Escape closes. Moves on to the next person's stories at the end.
 */
export function StoryViewer({ groups, startGroup, onClose }: { groups: StoryGroupItem[]; startGroup: number; onClose: () => void }) {
  const [gi, setGi] = useState(startGroup);
  const [fi, setFi] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const group = groups[gi];
  const frames = group ? framesOf(group) : [];
  const frame = frames[Math.min(fi, frames.length - 1)];

  const next = useCallback(() => {
    if (fi < frames.length - 1) setFi(fi + 1);
    else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setFi(0);
    } else onClose();
  }, [fi, frames.length, gi, groups.length, onClose]);
  const prev = useCallback(() => {
    if (fi > 0) setFi(fi - 1);
    else if (gi > 0) {
      setFi(framesOf(groups[gi - 1]).length - 1);
      setGi(gi - 1);
    }
  }, [fi, gi, groups]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, [next, prev, onClose]);

  if (!group || !frame) return null;
  const s = frame.story;
  const sample = !group.mine && group.author.isSimulated && !group.author.isLive;
  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-ink" role="dialog" aria-modal="true" aria-label={`${group.mine ? "Your" : `${group.author.name}'s`} story`} data-testid="story-viewer" data-frame={fi} data-frames={frames.length}>
      <div ref={panel} tabIndex={-1} className="relative flex h-full w-full max-w-md flex-col outline-none">
        <div className="absolute inset-x-0 top-0 z-10 px-2 pt-[max(env(safe-area-inset-top),8px)]">
          <div className="flex gap-1" aria-hidden>
            {frames.map((f, i) => (
              <span key={`${f.story.id}-${f.photo?.id ?? "t"}`} className="h-0.5 flex-1 overflow-hidden rounded-full bg-surface/30">
                <span className={cn("block h-full bg-surface", i <= fi ? "w-full" : "w-0")} />
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 px-1">
            <Avatar name={group.author.name} color={group.author.avatarColor} size={32} />
            <p className="min-w-0 flex-1 truncate text-body font-semibold text-surface">
              {group.mine ? "Your story" : group.author.name}
              <span className="ml-2 text-meta font-normal text-surface/70">
                {s.ago}
                {sample ? " · Sample person" : ""}
              </span>
            </p>
            {s.audience === "only_me" && <Lock size={14} className="text-surface/70" aria-label="Only me" />}
            <button type="button" onClick={onClose} aria-label="Close story" className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-surface hover:bg-surface/10" data-testid="story-close">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {frame.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.photo.url} alt={s.caption || `${group.author.name}'s story`} className="max-h-full w-full object-contain" data-testid="story-photo" />
          ) : (
            <p className="px-8 text-center text-headline font-bold text-surface">{s.caption}</p>
          )}
          <button type="button" aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" data-testid="story-prev" />
          <button type="button" aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 w-2/3" data-testid="story-next" />
        </div>

        {(frame.photo && s.caption) || s.event || s.aiSource ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/60 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] text-surface">
            {frame.photo && s.caption && <p className="text-body">{s.caption}</p>}
            {s.event && <p className="mt-1 text-meta text-surface/80">At {s.event.title} with {group.mine ? "your" : "their"} Link squad</p>}
            {s.aiSource && <div className="mt-1"><CaptionSource source={s.aiSource} edited={s.aiEdited} className="text-surface/80" /></div>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
