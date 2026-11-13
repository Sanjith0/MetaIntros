/**
 * Companion lines carry citations to the facts they used (e.g. "p05:groups[1]",
 * "live-dbe3dba0:socialStyle") for the code checks. Models sometimes also write them into the
 * sentence itself; people should never see them. Display-only: stored text is left as it was, so
 * prompts built from it (and cached replies) don't change.
 */
const ID = String.raw`[A-Za-z0-9_-]+:(?:(?:likes|groups|music|events|eventHistory|x_not_interested|dislikes)\[\d+\]|socialStyle|availability)`;
const LIST = String.raw`${ID}(?:\s*[,;/&]\s*${ID})*`;
const BRACKETED = new RegExp(String.raw`\s*(?:\[\s*${LIST}\s*\]|\(\s*(?:cites?:?\s*)?${LIST}\s*\)|\{\s*${LIST}\s*\})`, "g");
const BARE = new RegExp(String.raw`\s*\b${ID}`, "g");

export function stripCitations(text: string): string {
  if (!text || !text.includes(":")) return text;
  return text
    .replace(BRACKETED, "")
    .replace(BARE, "")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
