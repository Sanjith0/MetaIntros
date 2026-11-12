import { ruleLabel } from "./secret";
import { flag } from "@/lib/flags";
import { consentHistory } from "./consent";
import { LABEL, memoryOf } from "./memory";
import { profile, store } from "./store";

/**
 * "Your data" (F40): everything Party Queue holds about you, for you only.
 * Built by walking the store for records that are yours (keyed to your id),
 * never anyone else's private data. Each section says where to change it.
 */
export interface DataSection {
  id: string;
  title: string;
  /** Where you can change or delete it. */
  manage: { label: string; href: string } | null;
  items: string[];
}

export function myData(userId: string): { userId: string; name: string; sections: DataSection[] } {
  const s = store();
  const me = profile(userId);
  const title = (planId: string | null) => (planId ? (s.plans.get(planId)?.title ?? planId) : "no plan");
  const brief = s.briefs.get(`brief-${userId}`);
  const parties = [...s.parties.values()].filter((p) => p.memberIds.includes(userId));
  const sections: DataSection[] = [
    {
      id: "profile",
      title: "Your profile facts",
      manage: null,
      items: me.facts.map((f) => `${f.tag}: ${f.approved ? "approved for agents to use" : "not approved"}`),
    },
    {
      id: "brief",
      title: "Your sentence and private brief",
      manage: { label: "Change it while you wait", href: "/queue" },
      items: brief
        ? [
            brief.sentence ? `Sentence: “${brief.sentence}”` : "Sentence: forgotten",
            ...brief.hardRules.map((r) => `Rule: ${ruleLabel(r)} (“${r.sourceText}”)`),
            ...brief.preferences.map((p) => `Preference: ${p.tag}${p.sourceText.startsWith("remembered") ? ` (${p.sourceText})` : ""}`),
            ...brief.shareable.filter((l) => l.approved).map((l) => `Line you approved: “${l.text}”`),
          ]
        : [],
    },
    {
      id: "queue",
      title: "Your queue entries",
      manage: { label: "Leave the queue", href: "/queue" },
      items: s.queue.filter((e) => e.userId === userId).map((e) => `${s.events.get(e.eventId ?? "")?.title ?? e.landmark}: ${e.status}${e.scope === "night" ? " (anywhere that night)" : ""}`),
    },
    {
      id: "parties",
      title: "Your parties and what your agent did",
      manage: { label: "Forget my night", href: "/safety" },
      items: parties.map((p) => {
        const v = s.verdicts.filter((x) => x.partyId === p.id && x.ownerId === userId).length;
        const prompts = [...s.prompts.keys()].filter((k) => k.startsWith(`${p.id}:${userId}:`)).length;
        const forgotten = s.forgotten.has(`${p.id}:${userId}`);
        const auto = s.autoForgotten.has(`${p.id}:${userId}`);
        return `${title(p.planId)} (${p.status}): ${auto ? "your private data was deleted automatically after the night" : forgotten ? "your private data was forgotten" : `${v} private agent decisions, ${prompts} prompts, ${s.receipts.has(`${p.id}:${userId}`) ? "a receipt" : "no receipt"}`}`;
      }),
    },
    {
      id: "memory",
      title: "What your agent remembers",
      manage: { label: "Make my agent forget", href: "/runitback" },
      items: memoryOf(userId).map((m) => `${LABEL[m.tag] ?? m.tag} (from ${m.from})`),
    },
    {
      id: "picks",
      title: "Your run-it-back picks (never shown unless mutual)",
      manage: null,
      items: s.picks.filter((p) => p.pickerId === userId).map((p) => `${title(s.parties.get(p.partyId)?.planId ?? null)}: picked ${p.pickedIds.map((id) => profile(id).firstName).join(", ") || "nobody"}`),
    },
    {
      id: "safety",
      title: "Blocks and reports you made",
      manage: { label: "Safety", href: "/safety" },
      items: [...me.blocks.map((id) => `Blocked ${profile(id).firstName}`), ...s.reports.filter((r) => r.reporterId === userId).map((r) => `Reported ${profile(r.subjectId).firstName} (${r.reason})`)],
    },
    ...(flag("CONSENT_HISTORY")
      ? [
          {
            id: "consents",
            title: "Your consent history",
            manage: { label: "Take something back", href: "/me#sharing" },
            items: consentHistory(userId).map((e) => `${e.kind === "withdrew" ? "Took back" : "Agreed"} · ${e.text}`),
          },
        ]
      : []),
    {
      id: "messages",
      title: "Messages you sent",
      manage: null,
      items: (() => {
        const n = s.messages.filter((m) => m.senderId === userId && m.kind === "user").length;
        return n ? [`${n} chat ${n === 1 ? "message" : "messages"}`] : [];
      })(),
    },
  ];
  return { userId, name: me.name, sections };
}
