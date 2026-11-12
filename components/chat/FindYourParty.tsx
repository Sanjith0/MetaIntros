"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { Avatar, Button, ListRow, Section, Stack } from "@/components/fb";
import { useLiveEvents } from "@/components/useLiveEvents";

interface Arrival { id: string; name: string; avatarColor: string; checkedInAt: string | null; photoUrl: string | null; isSimulated?: boolean; isLive?: boolean }

async function resizeToDataUrl(file: File, max = 256): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Schematic map (after feat's MiniMap): a street grid and one pin at the meeting point. No tiles, no live location. */
function MiniMap({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 320 120" className="h-[120px] w-full" role="img" aria-label={`Map: ${label}`}>
      <rect width="320" height="120" className="fill-wash" />
      {[20, 60, 100].map((y) => <line key={`h${y}`} x1="0" x2="320" y1={y} y2={y} className="stroke-surface" strokeWidth="8" />)}
      {[40, 120, 200, 280].map((x) => <line key={`v${x}`} y1="0" y2="120" x1={x} x2={x} className="stroke-surface" strokeWidth="8" />)}
      <rect x="128" y="28" width="64" height="24" rx="4" className="fill-control" />
      <circle cx="160" cy="60" r="16" className="fill-badge" opacity="0.15" />
      <path d="M160 40c-7 0-12 5-12 12 0 9 12 20 12 20s12-11 12-20c0-7-5-12-12-12z" className="fill-badge" />
      <circle cx="160" cy="52" r="4" className="fill-surface" />
    </svg>
  );
}

export function FindYourParty({ partyId, meId, spot, lat, lng }: { partyId: string; meId: string; spot: string; lat: number; lng: number }) {
  const [list, setList] = useState<Arrival[]>([]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(() => fetch(`/api/party/${partyId}/checkin`).then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => {}), [partyId]);
  useEffect(() => {
    load();
  }, [load]);
  useLiveEvents(["party-update"], (_t, d) => {
    if ((d as { partyId?: string })?.partyId === partyId) load();
  }, load);
  const me = list.find((a) => a.id === meId);
  const here = list.filter((a) => a.checkedInAt).length;

  return (
    <Stack>
      <section className="bg-surface" data-testid="find-your-party">
        <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer" data-testid="meeting-pin" className="relative block">
          <MiniMap label={spot} />
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-meta font-semibold shadow-card">
            <Navigation size={12} aria-hidden /> Directions
          </span>
        </a>
        <div className="px-4 py-3">
          <p className="flex items-center gap-2 text-title font-semibold"><MapPin size={18} className="text-badge" aria-hidden /> {spot}</p>
          <p className="mt-0.5 text-meta text-muted">Your squad meets here, then walks in together.</p>
          <div className="mt-3 flex gap-2">
            <Button
              variant={me?.checkedInAt ? "on" : "primary"}
              className="flex-1"
              data-testid="im-here"
              disabled={busy}
              aria-pressed={Boolean(me?.checkedInAt)}
              icon={me?.checkedInAt ? <Check size={16} /> : <MapPin size={16} />}
              onClick={async () => {
                if (me?.checkedInAt) return;
                setBusy(true);
                await fetch(`/api/party/${partyId}/checkin`, { method: "POST" }).catch(() => {});
                setBusy(false);
                load();
              }}
            >
              {me?.checkedInAt ? "You're here" : "I'm here"}
            </Button>
            <Button
              className="flex-1"
              data-testid="photo-opt-in"
              icon={<Camera size={16} />}
              onClick={() => (me?.photoUrl ? fetch(`/api/party/${partyId}/photo`, { method: "POST", body: JSON.stringify({ dataUrl: null }) }).then(load) : file.current?.click())}
            >
              {me?.photoUrl ? "Remove photo" : "Share a photo"}
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              data-testid="photo-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const dataUrl = await resizeToDataUrl(f).catch(() => null);
                if (dataUrl) await fetch(`/api/party/${partyId}/photo`, { method: "POST", body: JSON.stringify({ dataUrl }) });
                load();
              }}
            />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-meta text-muted">
            <ShieldCheck size={14} className="mt-px shrink-0" aria-hidden /> A photo helps your squad spot you. Only this squad sees it, and it&apos;s deleted when the chat ends.
          </p>
        </div>
      </section>

      <Section flush title={<span>Who&apos;s here</span>} action={<span className="text-meta font-semibold text-positive" data-testid="arrival-count">{here} of {list.length} here</span>}>
        <ul data-testid="arrival-list">
          {list.map((a) => (
            <li key={a.id} data-testid="arrival" data-here={Boolean(a.checkedInAt)}>
              <ListRow
                leading={
                  <span className="relative">
                    <Avatar name={a.name} color={a.avatarColor} photoUrl={a.photoUrl} size={40} dim={!a.checkedInAt} />
                    {a.checkedInAt && (
                      <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-positive text-surface ring-2 ring-surface">
                        <Check size={10} strokeWidth={3} aria-hidden />
                      </span>
                    )}
                  </span>
                }
                title={a.id === meId ? "You" : a.name.split(" ")[0]}
                subtitle={`${a.checkedInAt ? "Here" : "On the way"}${a.id !== meId && a.isSimulated && !a.isLive ? " · Sample person" : ""}`}
              />
            </li>
          ))}
        </ul>
      </Section>
    </Stack>
  );
}
