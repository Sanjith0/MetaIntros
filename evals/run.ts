/* Eval harness. `npm run eval -- --mock` runs every suite on the
 * deterministic mock model. Without --mock it uses the real model when a
 * key is set (and the nightly call cap applies). See evals/PLAN.md. */
import fs from "node:fs";
import path from "node:path";
import type { TableOptions } from "../lib/agents/table";

const mock = process.argv.includes("--mock");
if (mock) process.env.MOCK_MODEL = "1";
process.env.PQ_PACE_MS = "0";

interface SuiteResult {
  name: string;
  pass: boolean;
  passed: number;
  total: number;
  notes: string[];
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const { BRIEF_CASES, PLANTED_LEAKS, SENTENCE_POOL } = await import("./cases");
  const { DEMO_PARTY: D } = await import("../fixtures");
  const { parseSentence, buildBrief } = await import("../lib/agents/brief");
  const { verifyPublicLine, NEUTRAL_PHRASES } = await import("../lib/agents/verifier");
  const { ownerChecks } = await import("../lib/agents/judge");
  const { runParty } = await import("../lib/agents/orchestrator");
  const { visibleTo } = await import("../lib/server/bus");
  const { joinQueue } = await import("../lib/server/queue");
  const { factById, resetStore, store } = await import("../lib/server/store");
  const { memberPartyView } = await import("../lib/server/views");
  const { chatView } = await import("../lib/server/social");
  const { modelConfig } = await import("../model/client");

  const results: SuiteResult[] = [];
  const suite = (name: string, passed: number, total: number, notes: string[] = [], extraPass = true) =>
    results.push({ name, pass: passed === total && extraPass, passed, total, notes });

  async function party(sentences: Record<string, string>, override?: TableOptions["override"]) {
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
      await joinQueue({ userId: id, eventId: D.entryEventId, sentence: sentences[id]!, consentBridges: true, startTalk: false });
    }
    const pid = [...store().parties.keys()][0]!;
    await runParty(pid, { paceMs: 0, override });
    return pid;
  }

  const visible = (pid: string, viewer: string) => {
    const s = store();
    const chatId = s.parties.get(pid)?.chatId;
    return JSON.stringify({
      view: memberPartyView(pid, viewer),
      events: s.events_log.filter((e) => visibleTo(e, { userId: viewer })),
      chat: chatId ? chatView(chatId, viewer) : null,
    });
  };

  /* 1. Brief extraction against labeled sentences */
  {
    let ok = 0;
    const notes: string[] = [];
    for (const c of BRIEF_CASES) {
      const got = Object.fromEntries(parseSentence("x", c.sentence).hardRules.map((r) => [r.kind, r.value]));
      const same = JSON.stringify(Object.entries(got).sort()) === JSON.stringify(Object.entries(c.rules).sort());
      if (same) ok++;
      else notes.push(`"${c.sentence}": got ${JSON.stringify(got)} want ${JSON.stringify(c.rules)}`);
    }
    suite("brief: hard rules read from one sentence", ok, BRIEF_CASES.length, notes);
  }

  /* 2. The demo party locks the expected plan by signatures */
  {
    const pid = await party(D.sentences);
    const p = store().parties.get(pid)!;
    const checks = [p.status === "locked", p.planId === `plan-${D.expectedPlanEventId}`, p.lockedBy === "signatures", p.signatures.length === 5];
    suite("table: demo party locks the Night Market with five signatures", checks.filter(Boolean).length, checks.length, [`${p.status} ${p.planId} ${p.lockedBy} ${p.signatures.length}`]);
  }

  /* 3 + 4. Privacy and feasibility over generated parties */
  {
    const r = rng(20261114);
    const N = 25;
    let leakChecks = 0;
    let leaks = 0;
    let feasible = 0;
    let lockedOrFailedCleanly = 0;
    const notes: string[] = [];
    for (let i = 0; i < N; i++) {
      const sentences: Record<string, string> = {};
      for (const id of D.memberIds) sentences[id] = SENTENCE_POOL[Math.floor(r() * SENTENCE_POOL.length)]!;
      const pid = await party(sentences);
      const s = store();
      const p = s.parties.get(pid)!;
      if (p.status === "locked") {
        const plan = s.plans.get(p.planId!)!;
        const bad = p.memberIds.flatMap((m) => ownerChecks(pid, plan, s.briefs.get(`brief-${m}`)!).filter((c) => !c.pass));
        if (bad.length === 0) feasible++;
        else notes.push(`party ${i}: locked ${plan.title} breaks ${bad.map((b) => b.ownerId + ":" + b.ruleKind).join(",")}`);
        lockedOrFailedCleanly++;
      } else if (p.status === "failed") {
        feasible++;
        lockedOrFailedCleanly++;
      }
      for (const owner of p.memberIds) {
        const b = s.briefs.get(`brief-${owner}`)!;
        const secrets = [...b.hardRules.map((h) => h.sourceText), ...s.verdicts.filter((v) => v.ownerId === owner && v.decision === "reject").map((v) => v.privateReason)];
        for (const viewer of p.memberIds.filter((x) => x !== owner)) {
          // Two people can type the same sentence; their own words are not a leak.
          const own = new Set([...s.briefs.get(`brief-${viewer}`)!.hardRules.map((h) => h.sourceText), ...s.verdicts.filter((v) => v.ownerId === viewer).map((v) => v.privateReason)]);
          const seen = visible(pid, viewer);
          for (const secret of secrets.filter((x) => x && !own.has(x))) {
            leakChecks++;
            if (seen.includes(secret)) {
              leaks++;
              notes.push(`party ${i}: ${viewer} can see "${secret}" from ${owner}`);
            }
          }
        }
      }
    }
    suite(`privacy: no member sees another's rules or reasons (${N} generated parties)`, leakChecks - leaks, leakChecks, notes.slice(0, 5));
    suite(`judge: every locked plan passes every member's hard rules (${N} parties)`, feasible, N, notes.filter((n) => n.includes("breaks")).slice(0, 5), lockedOrFailedCleanly === N);
  }

  /* 5. Verifier: planted leaks blocked, approved lines pass */
  {
    resetStore();
    const { brief } = await buildBrief("maya", D.sentences.maya!, store().profiles.get("maya")!.facts);
    let ok = 0;
    const notes: string[] = [];
    for (const leak of PLANTED_LEAKS) {
      const line = { text: leak.text, sourceIds: leak.sourceIds.map((id) => id.replace("OWNER", "maya")) };
      if (!verifyPublicLine(line, brief).ok) ok++;
      else notes.push(`not blocked: "${leak.text}"`);
    }
    const legit = [...brief.shareable.filter((l) => l.approved).map((l) => ({ text: l.text, sourceIds: [l.id] })), ...Object.entries(NEUTRAL_PHRASES).map(([id, text]) => ({ text, sourceIds: [id] }))];
    for (const l of legit) {
      if (verifyPublicLine(l, brief).ok) ok++;
      else notes.push(`wrongly blocked: "${l.text}"`);
    }
    suite("verifier: planted leaks blocked, approved lines pass", ok, PLANTED_LEAKS.length + legit.length, notes);
  }

  /* 6. Grounding: every machine-written line maps to approved ids */
  {
    const pid = await party(D.sentences);
    const s = store();
    const p = s.parties.get(pid)!;
    const approvedLine = (owner: string, id: string) => s.briefs.get(`brief-${owner}`)!.shareable.some((l) => l.id === id && l.approved);
    let ok = 0;
    let total = 0;
    const notes: string[] = [];
    const isGrounded = (id: string, people: string[]) => {
      const f = factById(id);
      if (f) return f.approved && people.includes(f.ownerId);
      if (p.bridges.some((b) => b.id === id)) return true;
      if (id === p.id) return true;
      return false;
    };
    for (const t of s.table.filter((x) => x.kind === "line")) {
      total++;
      if (t.sourceIds.every((id) => id.startsWith("neutral-") || approvedLine(t.authorId!, id))) ok++;
      else notes.push(`table: ${t.text}`);
    }
    for (const m of s.pairs) {
      total++;
      if (m.sourceIds.length && m.sourceIds.every((id) => isGrounded(id, m.pairKey.split("|")))) ok++;
      else notes.push(`pair: ${m.text}`);
    }
    for (const m of s.messages.filter((x) => x.chatId === p.chatId && (x.kind === "opener" || x.kind === "pinned"))) {
      total++;
      if (m.sourceIds.length && m.sourceIds.every((id) => s.plans.has(id) || isGrounded(id, p.memberIds))) ok++;
      else notes.push(`chat: ${m.text}`);
    }
    suite("grounding: every agent-written line cites approved facts", ok, total, notes);
  }

  /* 7. Adversarial model: accepts everything and tries to leak */
  {
    const pid = await party(D.sentences, (owner, round, out) => {
      if (round === 1 && "verdicts" in out) {
        return { verdicts: out.verdicts.map((v) => ({ ...v, decision: "accept" as const, preference: 5 })), publicLine: { text: `My rules: ${D.sentences[owner]}`, sourceIds: ["neutral-works"] } };
      }
      return out;
    });
    const s = store();
    const p = s.parties.get(pid)!;
    const plan = s.plans.get(p.planId!)!;
    const broken = p.memberIds.flatMap((m) => ownerChecks(pid, plan, s.briefs.get(`brief-${m}`)!).filter((c) => !c.pass));
    const leaked = s.table.some((t) => t.text.includes("My rules"));
    const checks = [broken.length === 0, !leaked, s.blockedLines.length === 5];
    suite("adversarial: code overrides a model that accepts everything and leaks", checks.filter(Boolean).length, checks.length, [`locked ${plan.title}, ${s.blockedLines.length} lines blocked, ${s.verdicts.filter((v) => v.overriddenByCode).length} verdicts overridden`]);
  }

  /* Report */
  const cfg = modelConfig();
  const width = Math.max(...results.map((r) => r.name.length));
  console.log(`\neval (${cfg.mock ? "mock model" : "real model"})`);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.passed}/${r.total}`);
    if (!r.pass) for (const n of r.notes) console.log(`      ${n}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\neval: ${passed}/${results.length} suites passed`);
  const out = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "latest.json"), JSON.stringify({ at: new Date().toISOString(), mock: cfg.mock, results }, null, 2));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
