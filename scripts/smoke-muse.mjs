// Smoke-test the Meta Model API with your key: `node --env-file=.env.local scripts/smoke-muse.mjs`
const base = process.env.META_API_BASE_URL?.replace(/\/$/, "");
const key = process.env.META_API_KEY;
if (!base || !key) {
  console.error("Set META_API_BASE_URL and META_API_KEY (see .env.example)");
  process.exit(1);
}
const models = [process.env.MUSE_SPARK_MODEL || "muse-spark-1.3", process.env.MUSE_EMBER_MODEL || "muse-ember-1.0"];
try {
  const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
  console.log("GET /models", r.status, (await r.text()).slice(0, 800));
} catch (e) {
  console.log("GET /models failed", e.message);
}
for (const model of models) {
  for (const json of [true, false]) {
    const t0 = Date.now();
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        reasoning_effort: process.env.MUSE_REASONING_EFFORT ?? "low",
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "user", content: 'Reply with JSON {"ok": true, "model": "<your name>"}' }],
      }),
    });
    const body = await r.text();
    console.log(`${model} json_mode=${json} → ${r.status} in ${Date.now() - t0}ms: ${body.slice(0, 300)}`);
  }
}
