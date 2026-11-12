"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Check, Clock, Heart, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useLiveEvents } from "@/components/useLiveEvents";

type State = "add" | "requested" | "incoming" | "friends" | "unavailable";
interface Member { id: string; name: string; avatarColor: string; state: State; sharedNote: string | null }
interface Data { partyId: string; eventTitle: string; over: boolean; members: Member[] }

export function SquadConnect({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const reload = useCallback(() => fetch(`/api/squad/${initial.partyId}/connect`).then((r) => r.json()).then(setData).catch(() => {}), [initial.partyId]);
  useLiveEvents(["friends"], reload);
  const add = async (id: string) => {
    setData((d) => ({ ...d, members: d.members.map((m) => (m.id === id ? { ...m, state: "requested" } : m)) }));
    await fetch(`/api/squad/${initial.partyId}/connect`, { method: "POST", body: JSON.stringify({ toId: id }) });
    reload();
  };
  const friends = data.members.filter((m) => m.state === "friends").length;
  return (
    <div className="min-h-[80dvh] bg-white px-4 pb-8 pt-4" data-testid="squad-connect">
      <p className="text-xs font-semibold uppercase tracking-wider text-queue-glow">After {data.eventTitle}</p>
      <h1 className="text-2xl font-extrabold leading-tight">Stay in touch with your squad</h1>
      <p className="mt-1 text-sm text-fb-muted">You only become friends if you both tap Add friend. Nobody is notified if you don&apos;t.</p>
      {!data.over && <p className="mt-3 rounded-lg bg-fb-bg p-2 text-sm">Friend requests open after the event.</p>}
      <ul className="mt-4 space-y-3">
        {data.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3" data-testid={`connect-${m.id}`} data-state={m.state}>
            <Avatar name={m.name} color={m.avatarColor} size={52} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{m.name}</span>
              {m.sharedNote && <span className="block truncate text-xs text-queue-glow"><Heart size={11} className="mr-1 inline" />You both love {m.sharedNote}</span>}
            </span>
            {m.state === "friends" ? (
              <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700"><Check size={15} /> Friends</span>
            ) : m.state === "requested" ? (
              <span className="flex items-center gap-1 rounded-lg bg-fb-bg px-3 py-1.5 text-sm text-fb-muted"><Clock size={14} /> Requested</span>
            ) : m.state === "unavailable" ? (
              <span className="text-xs text-fb-muted">Unavailable</span>
            ) : (
              <button type="button" disabled={!data.over} onClick={() => add(m.id)} data-testid={`add-${m.id}`}
                className="flex items-center gap-1 rounded-lg bg-fb-blue px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                <UserPlus size={15} /> {m.state === "incoming" ? "Accept" : "Add friend"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {friends > 0 && (
        <Link href="/friends?tab=queueup" data-testid="see-new-friends" className="mt-6 block rounded-xl bg-gradient-to-r from-[#1877f2] to-[#9333ea] p-3 text-center font-bold text-white">
          See your new friends ({friends})
        </Link>
      )}
    </div>
  );
}
