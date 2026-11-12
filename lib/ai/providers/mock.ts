import type { CompletionRequest, CompletionResult, LlmProvider } from "../types";

type Handler = (req: CompletionRequest) => string | Promise<string>;

/** Scriptable provider for tests. Register a handler per task; unhandled tasks throw (→ fallback). */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  calls: CompletionRequest[] = [];
  private handlers = new Map<string, Handler>();

  on(task: string, h: Handler) {
    this.handlers.set(task, h);
    return this;
  }

  reset() {
    this.calls = [];
    this.handlers.clear();
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(req);
    const h = this.handlers.get(req.task);
    if (!h) throw new Error(`mock: no handler for ${req.task}`);
    return { text: await h(req), model: "mock" };
  }
}
