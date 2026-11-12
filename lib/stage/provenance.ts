/** Shared by the server and the phones: where a machine-written line came from. No server imports. */
export interface SourceItem {
  kind: "fact" | "tie" | "plan" | "unknown";
  text: string;
  /** False only if a source was not approved by its owner (never expected; tests check). */
  ok: boolean;
}
