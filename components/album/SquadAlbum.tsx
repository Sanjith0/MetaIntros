"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Lock, Trash2 } from "lucide-react";
import { Avatar, Button, Section, Stack } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { TopBar } from "@/components/fb/TopBar";
import { useLiveEvents } from "@/components/useLiveEvents";
import type { AlbumPhotoView } from "@/lib/server/album";
import { resizeForAlbum } from "./resize";
import { Switch } from "./Switch";

interface Data { partyId: string; eventTitle: string; photos: AlbumPhotoView[]; max: number; full: boolean }

const ERRORS: Record<string, string> = {
  bad_image: "That photo couldn't be added. Try a JPEG or PNG.",
  too_big: "That photo is too large to add.",
  album_full: "This album is full.",
  caption_too_long: "Captions can be up to 80 characters.",
  sensitive_caption: "Captions can't mention politics, religion, health or sexuality.",
};
const first = (name: string) => name.split(" ")[0];

/**
 * The squad's shared album. Members add photos (several at a time); each photo carries the uploader's
 * consent for squadmates to include it in a post, on by default and changeable later. Only the
 * uploader can change or delete a photo.
 */
export function SquadAlbum({ initial }: { initial: Data }) {
  const id = initial.partyId;
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shareNew, setShareNew] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reload = useCallback(
    () =>
      fetch(`/api/squad/${id}/album`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setData(d))
        .catch(() => {}),
    [id],
  );
  useLiveEvents(["album"], (_t, d) => {
    if (!d || (d as { partyId?: string }).partyId === id) reload();
  }, reload);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = Math.max(0, data.max - data.photos.length);
    const list = [...files].slice(0, room);
    if (files.length > room) setError(room ? `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} in this album.` : ERRORS.album_full);
    setBusy(list.length);
    for (const f of list) {
      try {
        const dataUrl = await resizeForAlbum(f);
        const r = await fetch(`/api/squad/${id}/album`, { method: "POST", body: JSON.stringify({ dataUrl, shareable: shareNew }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) setError(ERRORS[j.error] ?? "That photo couldn't be added.");
      } catch (e) {
        setError(ERRORS[(e as Error).message] ?? ERRORS.bad_image);
      }
      setBusy((n) => n - 1);
    }
    if (input.current) input.current.value = "";
    reload();
  };

  const open = data.photos.find((p) => p.id === openId) ?? null;
  return (
    <div data-testid="squad-album">
      <TopBar back={`/squad/${id}`} title="Squad album" />
      <Stack>
        <Section>
          <h1 className="text-headline font-bold">Photos from {data.eventTitle}</h1>
          <p className="mt-1 text-body text-muted">Only your squad can see this album. It stays after the squad chat ends, and you can delete your photos any time.</p>
          <label className="-mx-4 mt-2 flex cursor-pointer items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium">Squadmates can include my new photos in a post</span>
              <span className="block text-meta text-muted">On by default. You can change it for each photo.</span>
            </span>
            <Switch checked={shareNew} onChange={(e) => setShareNew(e.target.checked)} data-testid="album-share-default" aria-label="Squadmates can include my new photos in a post" />
          </label>
          <Button variant="primary" block className="mt-2" icon={<ImagePlus size={18} />} disabled={data.full || busy > 0} onClick={() => input.current?.click()} data-testid="album-add">
            {busy > 0 ? `Adding ${busy} ${busy === 1 ? "photo" : "photos"}…` : "Add photos"}
          </Button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => add(e.target.files)} data-testid="album-input" />
          {error && <p role="alert" className="mt-2 text-meta text-badge" data-testid="album-error">{error}</p>}
          {data.full && !error && <p className="mt-2 text-meta text-muted">This album is full ({data.max} photos).</p>}
        </Section>

        <Section flush title={`${data.photos.length} ${data.photos.length === 1 ? "photo" : "photos"}`} className="pb-0">
          {data.photos.length === 0 ? (
            <p className="px-4 pt-2 pb-6 text-center text-body text-muted" data-testid="album-empty">No photos yet. Add the first one.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-0.5" data-testid="album-grid">
              {data.photos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(p.id)}
                    className="relative block aspect-square w-full overflow-hidden bg-control"
                    data-testid="album-photo"
                    data-mine={p.mine}
                    data-shareable={p.shareable}
                    aria-label={`${p.mine ? "Your photo" : `${first(p.uploader.name)}'s photo`}${p.caption ? `: ${p.caption}` : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {!p.shareable && (
                      <span className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-surface" title="Not shared in posts">
                        <Lock size={12} aria-hidden />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Stack>

      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.mine ? "Your photo" : open ? `${first(open.uploader.name)}'s photo` : ""} testId="album-photo-sheet">
        {open && <PhotoDetail key={open.id} partyId={id} photo={open} onChanged={reload} onDeleted={() => { setOpenId(null); reload(); }} />}
      </Sheet>
    </div>
  );
}

function PhotoDetail({ partyId, photo, onChanged, onDeleted }: { partyId: string; photo: AlbumPhotoView; onChanged: () => void; onDeleted: () => void }) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [shareable, setShareable] = useState(photo.shareable);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/squad/${partyId}/album/${photo.id}`;
  const patch = async (body: { shareable?: boolean; caption?: string | null }) => {
    setError(null);
    const r = await fetch(url, { method: "PATCH", body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(ERRORS[j.error] ?? "Couldn't save that.");
    onChanged();
    return r.ok;
  };
  const remove = async () => {
    const r = await fetch(url, { method: "DELETE" });
    if (r.ok) onDeleted();
    else setError("Couldn't delete that photo.");
  };
  return (
    <div className="px-4 pb-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption ?? ""} className="max-h-[50dvh] w-full rounded-card bg-wash object-contain" />
      <div className="mt-3 flex items-center gap-2">
        <Avatar name={photo.uploader.name} color={photo.uploader.avatarColor} size={32} />
        <p className="min-w-0 flex-1 text-meta text-muted">
          Added by {photo.mine ? "you" : photo.uploader.name}
          {!photo.mine && photo.uploader.isSimulated && !photo.uploader.isLive ? " · Sample person" : ""}
        </p>
      </div>
      {photo.mine ? (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ caption: caption.trim() || null });
            }}
          >
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={80}
              placeholder="Add a short caption"
              aria-label="Caption"
              className="h-9 min-w-0 flex-1 rounded-full bg-wash px-4 text-body outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="photo-caption"
            />
            <Button type="submit" disabled={caption.trim() === (photo.caption ?? "")} data-testid="photo-caption-save">Save</Button>
          </form>
          <label className="-mx-4 mt-2 flex cursor-pointer items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium">Squadmates can include this in a post</span>
              <span className="block text-meta text-muted">{shareable ? "On. Turning it off removes it from their posts too." : "Off. Only you can post this photo."}</span>
            </span>
            <Switch
              checked={shareable}
              onChange={async (e) => {
                const v = e.target.checked;
                setShareable(v);
                if (!(await patch({ shareable: v }))) setShareable(!v);
              }}
              data-testid="photo-shareable"
              aria-label="Squadmates can include this in a post"
            />
          </label>
          <Button block className="mt-2" icon={<Trash2 size={16} />} onClick={() => (confirm ? remove() : setConfirm(true))} data-testid="photo-delete">
            {confirm ? "Tap again to delete" : "Delete photo"}
          </Button>
        </>
      ) : (
        <>
          {photo.caption && <p className="mt-3 text-body">{photo.caption}</p>}
          <p className="mt-2 text-meta text-muted">
            {photo.shareable ? `${first(photo.uploader.name)} lets squadmates include this in a post.` : `Only ${first(photo.uploader.name)} can post this photo.`}
          </p>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-meta text-badge">{error}</p>}
    </div>
  );
}
