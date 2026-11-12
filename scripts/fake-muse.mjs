// Fake OpenAI-compatible server for exercising the "Muse live" code path without a key.
// node scripts/fake-muse.mjs  → then META_API_BASE_URL=http://localhost:4010 META_API_KEY=x npm run dev
import http from "node:http";
http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const { messages } = JSON.parse(body || "{}");
    const u = messages?.[1]?.content ?? "";
    let out = "Sounds amazing, see you there!";
    if (u.includes("Pick exactly")) {
      const ids = [...u.matchAll(/"id":"([a-z0-9]+)"/g)].map((m) => m[1]).filter((x) => x !== "maya");
      const pick = ["priya", "grace", "noor", "hannah", "aisha"].filter((x) => ids.includes(x));
      out = JSON.stringify({
        draft: ["priya", "grace", "jordan", "hannah", "aisha"].filter((x) => ids.includes(x)),
        swaps: [{ out: "jordan", in: "noor", reason: "Jordan wants an afterparty and isn't free until 7:30; Noor shares the group's quiet-hang energy." }],
        final: pick,
        rationale: "A gentle, Ghibli-loving crew who all want matcha and real conversation before the show.",
        vibe: "Matcha & melancholy",
        why: Object.fromEntries(pick.map((p) => [p, `Shares your love of Phoebe Bridgers and quiet pre-show hangs`])),
      });
    } else if (u.includes("timeWindow")) {
      out = "```json\n" + JSON.stringify({ venueId: "v-bluebonnet", time: "18:30", reasons: ["Quiet tables for six", "Everyone's budget", "6 min walk"] }) + "\n```";
    } else if (u.includes("allowedEvidence")) {
      const ev = JSON.parse(u).allowedEvidence;
      out = JSON.stringify({ hooks: [...ev.slice(0, 2).map((e) => ({ text: `AI hook about ${e}`, evidence: e })), { text: "made up", evidence: "likes:Nonexistent" }], opener: "AI opener!" });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: out } }] }));
  })
  .listen(4010, () => console.log("fake muse on :4010"));
