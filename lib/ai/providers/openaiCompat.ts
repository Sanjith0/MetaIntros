import type { CompletionRequest, CompletionResult, LlmProvider } from "../types";

/**
 * Any OpenAI-compatible /chat/completions endpoint. Muse (Meta Model API) speaks this
 * protocol at https://api.meta.ai/v1, so the same class serves Muse and any fallback.
 */
export class OpenAICompatProvider implements LlmProvider {
  constructor(
    readonly name: string,
    private cfg: {
      baseUrl: string;
      apiKey: string;
      model: string;
      /** Reasoning models (Muse Spark) spend hidden tokens before answering; they count against max_tokens. */
      reasoningHeadroom?: number;
      reasoningEffort?: string;
    },
  ) {}

  async complete(req: CompletionRequest, signal: AbortSignal): Promise<CompletionResult> {
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: req.messages,
        // Answer budget + reasoning headroom; you're billed only for tokens actually used.
        max_tokens: (req.maxTokens ?? 600) + (this.cfg.reasoningHeadroom ?? 0),
        temperature: req.temperature ?? 0.4,
        ...(this.cfg.reasoningEffort ? { reasoning_effort: this.cfg.reasoningEffort } : {}),
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${this.name} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const choice = j?.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      const why = choice?.finish_reason === "length" ? " (hit max_tokens — reasoning used the budget)" : choice?.message?.refusal ? ` (refused: ${choice.message.refusal})` : ` (finish_reason: ${choice?.finish_reason ?? "none"})`;
      throw new Error(`${this.name}: empty completion${why}`);
    }
    return { text, model: j.model ?? this.cfg.model, usage: { promptTokens: j.usage?.prompt_tokens, completionTokens: j.usage?.completion_tokens } };
  }
}

export function museFromEnv(): OpenAICompatProvider | null {
  const key = process.env.MODEL_API_KEY;
  if (!key) return null;
  return new OpenAICompatProvider("muse", {
    baseUrl: process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey: key,
    model: process.env.MUSE_MODEL ?? "muse-spark-1.1",
    reasoningHeadroom: Number(process.env.MUSE_REASONING_HEADROOM) || 2000,
    // "low" is accepted by Muse and roughly halves reasoning tokens; set MUSE_REASONING_EFFORT=none to omit.
    reasoningEffort: process.env.MUSE_REASONING_EFFORT === "none" ? undefined : process.env.MUSE_REASONING_EFFORT || "low",
  });
}

/** Optional secondary OpenAI-compatible provider (e.g. Llama API) if Muse errors. */
export function fallbackFromEnv(): OpenAICompatProvider | null {
  const key = process.env.FALLBACK_API_KEY;
  if (!key || !process.env.FALLBACK_BASE_URL || !process.env.FALLBACK_MODEL) return null;
  return new OpenAICompatProvider("fallback", { baseUrl: process.env.FALLBACK_BASE_URL, apiKey: key, model: process.env.FALLBACK_MODEL });
}
