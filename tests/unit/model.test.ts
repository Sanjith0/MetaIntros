import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { callModel, extractJson } from "@/model/client";

const Out = z.object({ answer: z.number() });
const base = {
  role: "spark" as const,
  task: "test",
  system: "s",
  user: "u",
  schema: Out,
  mock: () => ({ answer: 1 }),
  fallback: () => ({ answer: 2 }),
};

let server: http.Server;
let port = 0;
let reply: (res: http.ServerResponse) => void = () => {};

beforeAll(async () => {
  server = http.createServer((_req, res) => reply(res));
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

function realMode() {
  process.env.MOCK_MODEL = "0";
  process.env.META_API_KEY = "test-key-not-real";
  process.env.META_API_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.MODEL_COUNTER_FILE = path.join(os.tmpdir(), `pq-model-test-${process.pid}.json`);
}

const completion = (content: string) => (res: http.ServerResponse) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
};

describe("model client", () => {
  it("uses the mock when MOCK_MODEL=1", async () => {
    process.env.MOCK_MODEL = "1";
    const r = await callModel(base);
    expect(r).toMatchObject({ value: { answer: 1 }, source: "mock" });
  });

  it("defaults to mock when no key is set", async () => {
    delete process.env.MOCK_MODEL;
    delete process.env.META_API_KEY;
    const r = await callModel(base);
    expect(r.source).toBe("mock");
  });

  it("returns validated JSON from the API", async () => {
    realMode();
    reply = completion('```json\n{"answer": 42}\n```');
    const r = await callModel(base);
    expect(r).toMatchObject({ value: { answer: 42 }, source: "model" });
  });

  it("falls back when the JSON does not match the schema", async () => {
    realMode();
    reply = completion('{"answer": "forty-two"}');
    const r = await callModel(base);
    expect(r).toMatchObject({ value: { answer: 2 }, source: "fallback" });
  });

  it("falls back on timeout", async () => {
    realMode();
    reply = () => {}; // never answers
    const r = await callModel({ ...base, timeoutMs: 150 });
    expect(r).toMatchObject({ value: { answer: 2 }, source: "fallback", note: "timeout" });
  });

  it("falls back on HTTP errors", async () => {
    realMode();
    reply = (res) => {
      res.writeHead(500);
      res.end();
    };
    const r = await callModel(base);
    expect(r.source).toBe("fallback");
  });

  it("extracts JSON from noisy replies", () => {
    expect(extractJson('Sure! {"a":1}')).toEqual({ a: 1 });
  });
});
