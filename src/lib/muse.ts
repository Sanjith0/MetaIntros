// Thin wrapper over the Meta Model API (OpenAI-compatible chat completions).
// Every call has a timeout and returns null on any failure so callers can fall back.

const BASE = process.env.META_API_BASE_URL?.replace(/\/$/, "");
const KEY = process.env.META_API_KEY;

export const MODELS = {
  spark: process.env.MUSE_SPARK_MODEL || "muse-spark-1.3",
  ember: process.env.MUSE_EMBER_MODEL || "muse-ember",
};

export const museEnabled = () => Boolean(BASE && KEY) && process.env.FORCE_MOCK_AI !== "1";

interface CallOpts {
  model: keyof typeof MODELS;
  system: string;
  user: string;
  timeoutMs?: number;
  maxTokens?: number;
}

async function rawCall({ model, system, user, timeoutMs = 20000, maxTokens = 1200 }: CallOpts, jsonMode: boolean) {
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
        max_tokens: maxTokens,
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
    return { status: 200, text: (data?.choices?.[0]?.message?.content as string) ?? null };
  } catch (e) {
    console.warn(`[muse] ${MODELS[model]} failed:`, (e as Error).message);
    return { status: 0, text: null };
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
  if (r.status === 400 || r.status === 422) r = await rawCall(opts, false);
  return extractJson<T>(r.text);
}

export async function museText(opts: CallOpts): Promise<string | null> {
  if (!museEnabled()) return null;
  const r = await rawCall(opts, false);
  return r.text?.trim() || null;
}
