"use client";

import { useState } from "react";
import { Lock, Users, X } from "lucide-react";
import { Button, Chip, ChipRow, cn } from "@/components/fb";
import { AiSourceLabel } from "@/components/ai/AiSource";
import type { ShareablePhoto } from "@/lib/server/posts";

export interface ComposerAlbum { partyId: string; eventTitle: string; photos: ShareablePhoto[] }
type Kind = "post" | "story";
type Audience = "friends" | "only_me";

const MAX_PHOTOS = 10;
const ERRORS: Record<string, string> = {
  empty: "Add a photo or write something.",
  photo_not_allowed: "One of those photos isn't available any more. Pick again.",
  caption_too_long: "That's too long. Keep it under 500 characters.",
  not_found: "You can't post from that album.",
};
const first = (name: string) => name.split(" ")[0];

/**
 * Write a post or story from a squad album (or text only). Shows only photos the poster may use: their
 * own, and squadmates' with consent on. The server re-checks every rule before anything is posted.
 */
export function PostComposer({
  albums,
  initialPartyId,
  bindParty = false,
  initial,
  initialKind = "post",
  ai,
  onPosted,
  onCancel,
  cancelLabel = "Cancel",
  testId = "post-composer",
}: {
  albums: ComposerAlbum[];
  initialPartyId?: string | null;
  /** always attach the post to the squad (Share the outing), even with no photos */
  bindParty?: boolean;
  initial?: { photoIds: string[]; caption: string };
  initialKind?: Kind;
  /** set when the caption and photos started as an AI draft */
  ai?: { source: string; caption: string } | null;
  onPosted: (r: { id: string; kind: Kind }) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  testId?: string;
}) {
  const [partyId, setPartyId] = useState<string | null>(initialPartyId ?? albums[0]?.partyId ?? null);
  const album = albums.find((a) => a.partyId === partyId) ?? null;
  const [selected, setSelected] = useState<string[]>(() => (initial?.photoIds ?? []).filter((id) => album?.photos.some((p) => p.id === id)));
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [audience, setAudience] = useState<Audience>("friends");
  const [picker, setPicker] = useState(!ai);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoById = new Map((album?.photos ?? []).map((p) => [p.id, p]));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_PHOTOS ? s : [...s, id]));
  const edited = ai ? caption.trim() !== ai.caption.trim() : false;
  const empty = !caption.trim() && selected.length === 0;

  const share = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/posts", {
      method: "POST",
      body: JSON.stringify({ kind, audience, caption, partyId: selected.length || bindParty ? partyId : null, photoIds: selected, ai: ai ?? null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok) return setError(ERRORS[j?.error] ?? "Couldn't post that. Try again.");
    onPosted({ id: j.id, kind });
  };

  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      {ai && (
        <div className="rounded-card bg-wash p-3">
          <p className="flex flex-wrap items-center gap-x-1 text-meta text-muted">
            <AiSourceLabel source={ai.source} />
            {edited && <span data-testid="composer-edited">· Edited by you</span>}
          </p>
          <p className="mt-1 text-meta text-muted">
            {ai.source === "fallback"
              ? "AI wasn't available, so this is a simple template. Nothing is posted until you tap Share."
              : "The AI host saw who took each photo and when, never the photos themselves. Nothing is posted until you tap Share."}
          </p>
        </div>
      )}

      {selected.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-testid="composer-selected" aria-label="Photos in this post">
          {selected.map((id) => {
            const p = photoById.get(id);
            if (!p) return null;
            return (
              <li key={id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-card bg-control" data-testid="composer-selected-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.mine ? "Your photo" : `${first(p.uploaderName)}'s photo`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label="Remove photo"
                  className="press absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-surface"
                  data-testid="composer-remove-photo"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={kind === "story" ? "Add text to your story" : album ? `Say something about ${album.eventTitle}` : "What's on your mind?"}
        aria-label="Caption"
        className="w-full resize-none rounded-card bg-wash px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="composer-caption"
      />

      {albums.length > 0 && (
        <div>
          {!picker ? (
            <Button variant="ghost" size="sm" onClick={() => setPicker(true)} data-testid="composer-show-picker">Choose different photos</Button>
          ) : (
            <>
              <p className="text-body font-semibold">Photos from your squad album</p>
              {albums.length > 1 && (
                <ChipRow label="Album" className="mt-2">
                  {albums.map((a) => (
                    <Chip key={a.partyId} on={a.partyId === partyId} onClick={() => { setPartyId(a.partyId); setSelected([]); }}>
                      {a.eventTitle}
                    </Chip>
                  ))}
                </ChipRow>
              )}
              {album && album.photos.length > 0 ? (
                <ul className="mt-2 grid grid-cols-4 gap-1" data-testid="composer-photos">
                  {album.photos.map((p) => {
                    const n = selected.indexOf(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          aria-pressed={n >= 0}
                          aria-label={p.mine ? "Your photo" : `${first(p.uploaderName)}'s photo`}
                          className={cn("relative block aspect-square w-full overflow-hidden rounded-btn bg-control", n >= 0 && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
                          data-testid="composer-photo"
                          data-photo-id={p.id}
                          data-mine={p.mine}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          {n >= 0 && <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-meta font-semibold text-surface">{n + 1}</span>}
                          {!p.mine && <span className="absolute inset-x-0 bottom-0 truncate bg-ink/50 px-1 text-left text-[11px] leading-4 text-surface">{first(p.uploaderName)}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-meta text-muted">No photos you can use yet.</p>
              )}
              <p className="mt-2 text-meta text-muted">Squadmates&apos; photos show here only if they allowed them in posts.</p>
            </>
          )}
        </div>
      )}

      <div role="group" aria-label="Share as" className="flex flex-wrap items-center gap-2">
        <Chip on={kind === "post"} onClick={() => setKind("post")} data-testid="composer-kind-post">Post</Chip>
        <Chip on={kind === "story"} onClick={() => setKind("story")} data-testid="composer-kind-story">Story</Chip>
      </div>
      <div role="group" aria-label="Audience" className="flex flex-wrap items-center gap-2">
        <Chip on={audience === "friends"} onClick={() => setAudience("friends")} data-testid="composer-audience-friends"><Users size={16} aria-hidden /> Friends</Chip>
        <Chip on={audience === "only_me"} onClick={() => setAudience("only_me")} data-testid="composer-audience-only-me"><Lock size={16} aria-hidden /> Only me</Chip>
      </div>
      <p className="-mt-1 text-meta text-muted">{kind === "story" ? "Stories disappear after 24 hours." : "You can delete your post later."} {audience === "friends" ? "Your friends can see it." : "Only you can see it."}</p>

      {error && <p role="alert" className="text-meta text-badge" data-testid="composer-error">{error}</p>}
      <Button variant="primary" size="lg" block disabled={busy || empty} onClick={share} data-testid="composer-share">
        {busy ? "Sharing…" : kind === "story" ? "Share to story" : "Share"}
      </Button>
      {onCancel && (
        <Button block onClick={onCancel} data-testid="composer-cancel">{cancelLabel}</Button>
      )}
    </div>
  );
}
