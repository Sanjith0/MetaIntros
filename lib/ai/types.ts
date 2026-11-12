export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  /** logical task name (used for mocks, cache namespacing, traces) */
  task: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface LlmProvider {
  readonly name: string;
  complete(req: CompletionRequest, signal: AbortSignal): Promise<CompletionResult>;
}

/** mock = tests (never network); cache = cache or deterministic fallback (offline demo); live = cache, then Muse on miss. */
export type AiMode = "mock" | "cache" | "live";

export type AiSource = "mock" | "cache" | "live" | "fallback";
