import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatProvider } from "@/lib/ai/providers/openaiCompat";

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const req = { task: "t", messages: [{ role: "user" as const, content: "hi" }], maxTokens: 220, json: true };

afterEach(() => vi.unstubAllGlobals());

describe("OpenAICompatProvider (Muse reasoning model)", () => {
  it("adds reasoning headroom to max_tokens and sends reasoning_effort", async () => {
    const f = reply({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] });
    vi.stubGlobal("fetch", f);
    const p = new OpenAICompatProvider("muse", { baseUrl: "https://x/v1", apiKey: "k", model: "m", reasoningHeadroom: 2000, reasoningEffort: "low" });
    const r = await p.complete(req, new AbortController().signal);
    expect(r.text).toBe('{"ok":true}');
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBe(2220);
    expect(body.reasoning_effort).toBe("low");
  });

  it("explains a null completion cut off by max_tokens", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: null }, finish_reason: "length" }] }));
    const p = new OpenAICompatProvider("muse", { baseUrl: "https://x/v1", apiKey: "k", model: "m" });
    await expect(p.complete(req, new AbortController().signal)).rejects.toThrow(/empty completion \(hit max_tokens/);
  });
});
