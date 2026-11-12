"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";

interface Arrival { id: string; name: string; avatarColor: string; checkedInAt: string | null; photoUrl: string | null }

async function resizeToDataUrl(file: File, max = 256): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
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
  });
  const me = list.find((a) => a.id === meId);
  const here = list.filter((a) => a.checkedInAt).length;

  return (
    <div className="mt-3 rounded-xl border border-[#e9e3ff] p-2.5" data-testid="find-your-party">
      <p className="flex items-center justify-between text-sm font-bold">
        <span>Find your party</span>
        <span className="text-xs font-semibold text-emerald-600" data-testid="arrival-count">{here}/{list.length} here</span>
      </p>
      <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer" data-testid="meeting-pin"
        className="relative mt-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(90deg,#e8eef7_1px,transparent_1px),linear-gradient(#e8eef7_1px,transparent_1px)] bg-[size:18px_18px] bg-[#f5f8fc]">
        <span className="absolute h-14 w-14 animate-ping rounded-full bg-[#e41e3f]/15" />
        <MapPin className="relative text-[#e41e3f]" size={30} fill="#fecaca" />
        <span className="absolute bottom-1 left-2 right-2 truncate text-center text-[11px] font-semibold text-fb-text">{spot}</span>
        <Navigation size={12} className="absolute right-2 top-2 text-fb-muted" />
      </a>
      <ul className="mt-2 grid grid-cols-4 gap-2" data-testid="arrival-list">
        {list.map((a) => (
          <li key={a.id} className="flex flex-col items-center" data-testid="arrival" data-here={Boolean(a.checkedInAt)}>
            <span className="relative">
              <Avatar name={a.name} color={a.avatarColor} photoUrl={a.photoUrl} size={40} className={a.checkedInAt ? "" : "opacity-50 grayscale"} />
              {a.checkedInAt && <CheckCircle2 size={16} className="absolute -bottom-1 -right-1 rounded-full bg-white text-emerald-500" />}
            </span>
            <span className="mt-0.5 w-full truncate text-center text-[10px]">{a.id === meId ? "You" : a.name.split(" ")[0]}</span>
            <span className="text-[9px] text-fb-muted">{a.checkedInAt ? "here" : "on the way"}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" data-testid="im-here" disabled={busy || Boolean(me?.checkedInAt)}
          onClick={async () => { setBusy(true); await fetch(`/api/party/${partyId}/checkin`, { method: "POST" }); setBusy(false); load(); }}
          className="rounded-lg bg-emerald-500 py-2 text-sm font-bold text-white disabled:opacity-60">
          {me?.checkedInAt ? "✓ You're here" : "I'm here"}
        </button>
        <button type="button" data-testid="photo-opt-in" onClick={() => (me?.photoUrl ? fetch(`/api/party/${partyId}/photo`, { method: "POST", body: JSON.stringify({ dataUrl: null }) }).then(load) : file.current?.click())}
          className="flex items-center justify-center gap-1 rounded-lg bg-fb-bg py-2 text-sm font-semibold">
          <Camera size={15} /> {me?.photoUrl ? "Remove photo" : "Party-only photo"}
        </button>
        <input ref={file} type="file" accept="image/*" capture="user" className="hidden" data-testid="photo-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const dataUrl = await resizeToDataUrl(f).catch(() => null);
            if (dataUrl) await fetch(`/api/party/${partyId}/photo`, { method: "POST", body: JSON.stringify({ dataUrl }) });
            load();
          }} />
      </div>
      <p className="mt-1.5 flex items-start gap-1 text-[10px] text-fb-muted"><ShieldCheck size={11} className="mt-px shrink-0" /> Your photo is only visible to this squad and is deleted when the chat ends.</p>
    </div>
  );
}
