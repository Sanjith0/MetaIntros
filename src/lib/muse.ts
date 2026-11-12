// Thin wrapper over the Meta Model API (OpenAI-compatible chat completions).
// Every call has a timeout and returns null on any failure so callers can fall back.

const BASE = process.env.META_API_BASE_URL?.replace(/\/$/, "");
const KEY = process.env.META_API_KEY;

export const MODELS = {
  spark: process.env.MUSE_SPARK_MODEL || "muse-spark-1.3",
  ember: process.env.MUSE_EMBER_MODEL || "muse-ember-1.0",
};

// Muse models reason before answering, and reasoning tokens count against max_tokens.
// Callers size maxTokens for the visible answer; this headroom is added on top so the
// answer isn't cut off (finish_reason "length" with null content).
const REASONING_HEADROOM = Number(process.env.MUSE_REASONING_HEADROOM ?? 3000);
const REASONING_EFFORT = process.env.MUSE_REASONING_EFFORT ?? "low"; // "" to omit

export const museEnabled = () => Boolean(BASE && KEY) && process.env.FORCE_MOCK_AI !== "1";

interface CallOpts {
  model: keyof typeof MODELS;
  system: string;
  user: string;
  timeoutMs?: number;
  maxTokens?: number;
}

async function rawCall({ model, system, user, timeoutMs = 30000, maxTokens = 1200 }: CallOpts, jsonMode: boolean) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODELS[model],
        temperature: 0.4,
        max_tokens: maxTokens + REASONING_HEADROOM,
        ...(REASONING_EFFORT ? { reasoning_effort: REASONING_EFFORT } : {}),
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[muse] ${MODELS[model]} HTTP ${res.status}: ${body.slice(0, 300)}`);
      return { status: res.status, text: null as string | null };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const text = (choice?.message?.content as string) ?? null;
    if (!text || choice?.finish_reason !== "stop") {
      console.warn(`[muse] ${MODELS[model]} finish=${choice?.finish_reason} content=${text ? text.length + " chars" : "null"} usage=${JSON.stringify(data?.usage)}`);
    }
    return { status: 200, text };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const aborted = err.name === "AbortError";
    console.warn(`[muse] ${MODELS[model]} failed: ${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ""}`);
    // -1 = network error, worth one retry. A timeout (0) is not retried.
    return { status: aborted ? 0 : -1, text: null };
  } finally {
    clearTimeout(t);
  }
}

export function extractJson<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Ask for JSON. Retries once without response_format if the server rejects it. */
export async function museJson<T>(opts: CallOpts): Promise<T | null> {
  if (!museEnabled()) return null;
  let r = await rawCall(opts, true);
  if (r.status === -1) r = await rawCall(opts, true);
  if (r.status === 400 || r.status === 422) r = await rawCall(opts, false);
  return extractJson<T>(r.text);
}

export async function museText(opts: CallOpts): Promise<string | null> {
  if (!museEnabled()) return null;
  let r = await rawCall(opts, false);
  if (r.status === -1) r = await rawCall(opts, false);
  return r.text?.trim() || null;
}
