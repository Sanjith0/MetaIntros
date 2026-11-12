import fs from "node:fs";
import path from "node:path";
import { DEMO_IDS, DEMO_PARTY } from "@/fixtures";
import { auditContext } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { FLAG_NAMES, flag, flagDefault } from "@/lib/flags";
import { modelConfig, realCallsUsed, withMockModel } from "@/model/client";
import { modelSettings } from "@/model/settings";
import { tryLeak } from "./attempt";
import { connected, screensConnected } from "./phones";
import { joinQueue } from "./queue";
import { secretView } from "./secret";
import { profile, runIsolated, store } from "./store";

/**
 * Preflight, for whoever is presenting. Checks the settings that change the
 * demo, then rehearses the whole demo party in a sandbox (its own store, the
 * mock model, nothing live touched) and checks the outcome and the privacy
 * claims the demo makes. Nothing here changes anything.
 */

export interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

const pass = (id: string, label: string, detail: string): Check => ({ id, label, status: "ok", detail });
const warn = (id: string, label: string, detail: string): Check => ({ id, label, status: "warn", detail });
const fail = (id: string, label: string, detail: string): Check => ({ id, label, status: "fail", detail });

function flagsCheck(): Check {
  const off = FLAG_NAMES.filter((n) => flagDefault(n) && !flag(n));
  const extra = FLAG_NAMES.filter((n) => !flagDefault(n) && flag(n));
  if (off.length) return fail("flags", "Layers", `Off: ${off.join(", ")}. Turn them back on in Layers below, or the demo script won't match.`);
  return pass("flags", "Layers", `All ${FLAG_NAMES.filter((n) => flagDefault(n)).length} layers on${extra.length ? `, plus ${extra.join(", ")}` : "; voice is off, as it should be"}.`);
}

function modelCheck(): Check {
  const cfg = modelConfig();
  const used = realCallsUsed();
  const st = modelSettings();
  if (st.source === "recorded") return pass("model", "Model", "Recorded replay: every agent turn comes from a saved run and is labelled so on the stage.");
  if (cfg.mock) return pass("model", "Model", `Mock model (no key): deterministic. Real calls used tonight: ${used} of ${cfg.cap}.`);
  if (used >= cfg.cap - 30) return warn("model", "Model", `Live model, ${used} of ${cfg.cap} real calls used. A table talk takes up to 15; Lock now is ready if it runs out.`);
  return pass("model", "Model", `Live model, ${used} of ${cfg.cap} real calls used. If it's slow, Lock now picks the best valid plan.`);
}

function paceCheck(): Check {
  const st = modelSettings();
  const notes: string[] = [];
  if (st.timeoutAgent) notes.push(`${profile(st.timeoutAgent).firstName}'s agent is set to time out (a fallback demo)`);
  if (st.simulateLatency) notes.push(`network latency is simulated (×${st.latencyScale})`);
  const pace = st.paceMs ?? Number(process.env.PQ_PACE_MS ?? NaN);
  const paceText = Number.isFinite(pace) ? `${pace} ms per step` : "Default pace";
  return notes.length ? warn("pace", "Pace", `${paceText}; ${notes.join("; ")}. Fine if you meant it.`) : pass("pace", "Pace", `${paceText}, no forced timeouts.`);
}

function liveCheck(): Check {
  const s = store();
  const talking = [...s.parties.values()].filter((p) => p.status === "forming" || p.status === "talking");
  const waiting = s.queue.filter((e) => e.status === "waiting");
  if (talking.length) return warn("live", "Live state", `A party is talking right now. Reset everything before you start, unless that's your demo.`);
  if (s.parties.size) return warn("live", "Live state", `${s.parties.size} ${s.parties.size === 1 ? "party" : "parties"} from earlier. Reset everything for a clean start.`);
  return pass("live", "Live state", waiting.length ? `Clean. ${waiting.map((e) => profile(e.userId).firstName).join(", ")} waiting in the queue.` : "Clean: no parties, nobody queued.");
}

function screensCheck(): Check {
  const projector = screensConnected("stage");
  const phones = DEMO_IDS.filter((id) => connected(id)).map((id) => profile(id).firstName);
  const phoneText = phones.length ? `Phones live: ${phones.join(", ")}.` : "No demo phones connected (fine if you use /phones or one laptop).";
  return projector ? pass("screens", "Screens", `Projector (/stage) connected. ${phoneText}`) : warn("screens", "Screens", `Open /stage on the projector. ${phoneText}`);
}

function fallbacksCheck(): Check {
  const missing: string[] = [];
  let calls = 0;
  try {
    calls = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures/recordings/demo-party.json"), "utf8")).calls ?? {}).length;
  } catch {
    missing.push("the recorded run");
  }
  if (!fs.existsSync(path.join(process.cwd(), "fixtures/frames/dev-at-door.json"))) missing.push("the door frame");
  return missing.length ? fail("fallbacks", "Fallbacks", `Missing ${missing.join(" and ")}.`) : pass("fallbacks", "Fallbacks", `Recorded run (${calls} calls) and the door frame are in place.`);
}

/** The whole demo party, end to end, in a sandbox. */
async function rehearse(): Promise<Check[]> {
  return withMockModel(() =>
    runIsolated(async () => {
      const t0 = Date.now();
      const ids = ["dev", "ana", "kai", "zoe", "maya"];
      for (const id of ids) await joinQueue({ userId: id, eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences[id]!, consentBridges: true, startTalk: false });
      const s = store();
      const party = [...s.parties.values()][0];
      if (!party) return [fail("rehearsal", "Rehearsal", "The five demo people didn't form a party.")];
      await runParty(party.id, { paceMs: 0 });
      const ms = Date.now() - t0;
      const plan = party.planId ? s.plans.get(party.planId) : undefined;
      const match = s.events_log.filter((e) => e.type === "match.found");
      const heard = new Set(match.flatMap((e) => (e.audience.kind === "users" ? e.audience.userIds : ids)));
      const openers = s.messages.filter((m) => m.kind === "opener").length;
      const out: Check[] = [];
      const want = `plan-${DEMO_PARTY.expectedPlanEventId}`;
      if (party.status !== "locked" || party.planId !== want) out.push(fail("rehearsal", "Rehearsal", `Expected ${want} to lock; got ${party.status} ${party.planId ?? ""}.`));
      else if (ids.some((id) => !heard.has(id))) out.push(fail("rehearsal", "Rehearsal", `MATCH FOUND reached only ${heard.size} of 5.`));
      else
        out.push(
          pass(
            "rehearsal",
            "Rehearsal",
            `${plan!.title} locked by ${party.lockedBy === "signatures" ? "five signatures" : "code"} in ${ms} ms; MATCH FOUND to all five; ${s.cards.filter((c) => c.partyId === party.id).length} cards; ${openers} openers.`,
          ),
        );

      // The privacy claims the demo makes, checked on the rehearsal.
      const leaks = ids.flatMap((id) => secretView(party.id, id)?.partyKnows ?? []);
      const ctx = [...s.prompts.entries()].reduce((n, [k, p]) => n + auditContext(p.user, party.id, k.split(":")[1]!).others.length, 0);
      const leak = tryLeak(party.id, "dev", "heads up, Maya said out by eleven and nowhere I have to drink");
      const problems = [leaks.length ? `${leaks.length} private phrases visible to others` : "", ctx ? `${ctx} prompts held someone else's words` : "", leak?.ok ? "the leak test went through" : ""].filter(Boolean);
      out.push(
        problems.length
          ? fail("privacy", "Privacy", problems.join("; ") + ".")
          : pass("privacy", "Privacy", `What the party knows: nothing, for all five. ${s.prompts.size} prompts, own brief only. The leak test is blocked.`),
      );
      return out;
    }),
  );
}

export async function runPreflight(): Promise<{ ready: boolean; checks: Check[] }> {
  const checks = [flagsCheck(), modelCheck(), paceCheck(), ...(await rehearse()), liveCheck(), screensCheck(), fallbacksCheck()];
  return { ready: checks.every((c) => c.status !== "fail"), checks };
}
