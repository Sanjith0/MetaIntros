"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, KeyRound, UserPlus, Users } from "lucide-react";
import { Avatar, Button, FacePile, IconCircle, ListRow } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { useLiveEvents } from "@/components/useLiveEvents";
import type { GroupInvite, GroupView } from "@/lib/server/groups";

interface Friend { id: string; name: string; avatarColor: string; status: string | null; eligible: boolean }
interface State { group: GroupView | null; invites: GroupInvite[]; friends: Friend[] }
export type TogetherRole = { role: "none" | "host" | "member"; joined: number };

const first = (n: string) => n.split(" ")[0];
const ERR: Record<string, string> = {
  not_found: "That code doesn't match a group that's still open.",
  full: "That group is full.",
  unsafe: "You can't queue with this group.",
  age: "Queue Up is for people 18 and over.",
  self: "That's your own code.",
  not_friends: "You can only invite friends. Share your code instead.",
  already_queued: "Your group is already in the queue.",
};

/**
 * Queue together, like a party in a game: invite friends or share a code, then the host taps Find my squad
 * and everyone queues as one. Queue Up fills the other spots and never splits the group.
 */
export function QueueTogether({ onRole }: { onRole: (r: TogetherRole) => void }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Opening replaces the row you tapped: move focus to the section heading so you don't lose your place.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (expanded) heading.current?.focus();
  }, [expanded]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch("/api/groups").then((r) => (r.ok ? r.json() : null)).then((j: State | null) => j && setS(j)).catch(() => {}), []);
  useEffect(() => {
    load();
  }, [load]);
  useLiveEvents(["group"], load, load);

  const g = s?.group ?? null;
  const joined = g ? g.members.filter((m) => m.status === "joined") : [];
  const role: TogetherRole["role"] = !g ? "none" : g.isHost ? "host" : "member";
  useEffect(() => {
    onRole({ role, joined: joined.length });
  }, [role, joined.length, onRole]);
  // When the host starts the queue, everyone in the group goes to the queue screen.
  useEffect(() => {
    if (g && g.status === "queued") router.push("/queue");
  }, [g, router]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/groups", { method: "POST", body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!j.ok) setError(ERR[j.error] ?? "Something went wrong. Try again.");
    await load();
    return j.ok as boolean;
  };

  // Collapsed to one row until you want it; a group or an invite opens it by itself. The row needs no data,
  // so it shows while groups load and nothing below it jumps.
  if (!s || (!expanded && !g && s.invites.length === 0))
    return (
      <div data-testid="queue-together" data-role={role}>
        <ListRow
          onClick={() => setExpanded(true)}
          testId="bring-friends"
          leading={<IconCircle><UserPlus size={18} /></IconCircle>}
          title="Bring friends"
          trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
        />
      </div>
    );

  return (
    <section className="pt-2 pb-1" aria-labelledby="together-label" data-testid="queue-together" data-role={role}>
      <h3 id="together-label" ref={heading} tabIndex={-1} className="px-4 text-body font-semibold">Bring friends</h3>

      {s.invites.map((inv) => (
        <div key={inv.groupId} className="mx-4 mt-2 flex items-center gap-3 rounded-card bg-wash p-3" data-testid="group-invite">
          <Avatar name={inv.host.name} color={inv.host.avatarColor} size={40} />
          <p className="min-w-0 flex-1 text-meta">
            <span className="font-semibold">{inv.host.name}</span> invited you to queue together
          </p>
          <Button size="sm" variant="on" disabled={busy} onClick={() => act({ action: "respond", groupId: inv.groupId, accept: true })} data-testid="group-invite-join">Join</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ action: "respond", groupId: inv.groupId, accept: false })} data-testid="group-invite-decline">Decline</Button>
        </div>
      ))}

      {role === "member" && g ? (
        <div className="mx-4 mt-2 rounded-card bg-wash p-3" data-testid="group-member-card">
          <div className="flex items-center gap-3">
            <FacePile people={joined.map((m) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor }))} size={32} />
            <p className="min-w-0 flex-1 text-body">
              You&apos;re queuing with <span className="font-semibold">{first(g.host.name)}</span>
              {joined.length > 2 ? ` and ${joined.length - 2} more` : ""}
            </p>
          </div>
          <p className="mt-1 text-meta text-muted">{first(g.host.name)} starts the queue.</p>
          <Button size="sm" variant="secondary" className="mt-2" disabled={busy} onClick={() => act({ action: "leave" })} data-testid="group-leave">Leave group</Button>
        </div>
      ) : (
        <>
          {g && joined.length + g.members.filter((m) => m.status === "invited").length > 1 && (
            <ul className="mt-1" data-testid="group-members">
              {g.members.map((m) => (
                <li key={m.id}>
                  <ListRow
                    leading={<Avatar name={m.name} color={m.avatarColor} size={36} />}
                    title={m.id === g.host.id ? `${m.name} (you)` : m.name}
                    subtitle={m.status === "joined" ? "In your group" : "Invited"}
                    data={{ member: m.id, status: m.status }}
                    testId="group-member"
                  />
                </li>
              ))}
            </ul>
          )}
          <ListRow
            onClick={() => setPicking(true)}
            testId="group-invite-friends"
            leading={<IconCircle><UserPlus size={18} /></IconCircle>}
            title="Invite friends"
            trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
          />
          {g ? (
            <p className="mx-4 mt-1 flex items-center gap-2 text-meta text-muted" data-testid="group-code-line">
              <KeyRound size={16} className="text-ink" aria-hidden />
              <span>
                Or share your code <span className="text-title font-bold text-ink" data-testid="group-code">{g.code}</span>
              </span>
            </p>
          ) : (
            <ListRow
              onClick={() => act({ action: "create" })}
              testId="group-get-code"
              leading={<IconCircle><KeyRound size={18} /></IconCircle>}
              title="Get a code to share"
              subtitle="Anyone with the code can join your group"
              trailing={<ChevronRight size={20} className="text-muted" aria-hidden />}
            />
          )}
          <form
            className="mx-4 mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (code.trim().length >= 4 && (await act({ action: "join", code: code.trim() }))) setCode("");
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="Have a code?"
              aria-label="Group code"
              autoCapitalize="characters"
              data-testid="group-code-input"
              className="h-9 min-w-0 flex-1 rounded-full bg-control px-4 text-body outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
            <Button size="md" variant="secondary" type="submit" disabled={busy || code.trim().length < 4} data-testid="group-code-join">Join</Button>
          </form>
        </>
      )}
      {error && <p role="alert" className="mx-4 mt-2 text-meta font-semibold text-badge" data-testid="group-error">{error}</p>}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Invite friends" testId="group-invite-sheet">
        <ul className="pb-2">
          {s.friends.map((f) => (
            <li key={f.id}>
              <ListRow
                leading={<Avatar name={f.name} color={f.avatarColor} size={40} />}
                title={f.name}
                subtitle={f.status === "joined" ? "In your group" : f.status === "invited" ? "Invited" : f.eligible ? undefined : "Can't be in a squad with your group"}
                testId="group-friend"
                data={{ friend: f.id }}
                trailing={
                  f.status ? null : (
                    <Button size="sm" variant="on" disabled={busy || !f.eligible} onClick={() => act({ action: "invite", userId: f.id })} data-testid={`group-invite-${f.id}`}>
                      Invite
                    </Button>
                  )
                }
              />
            </li>
          ))}
          {s.friends.length === 0 && (
            <li className="flex items-center gap-2 px-4 py-6 text-muted">
              <Users size={18} aria-hidden /> No friends yet. Share your code instead.
            </li>
          )}
        </ul>
      </Sheet>
    </section>
  );
}
