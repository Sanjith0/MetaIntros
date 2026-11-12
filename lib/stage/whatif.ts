/** Shared by the server and the stage: a "what if" sandbox run. No server imports. */

export interface WhatIfRule {
  id: string;
  label: string;
  words: string;
}

export interface WhatIfMember {
  id: string;
  name: string;
  rules: WhatIfRule[];
}

export interface WhatIfOutcome {
  locked: string | null;
  lockedBy: "signatures" | "fallback" | null;
  unavailable: string[];
}

export interface WhatIfRemoved extends WhatIfRule {
  ownerId: string;
  name: string;
}

export interface WhatIfResult {
  ok: true;
  removed: WhatIfRemoved[];
  live: WhatIfOutcome;
  sandbox: WhatIfOutcome;
  /** Plans unavailable tonight that the sandbox found open once the rules were gone. */
  opened: string[];
  changed: boolean;
}

/** `Maya's "No drink minimum" and Ana's "Done by 12 AM"` */
export function removedLabel(removed: WhatIfRemoved[]): string {
  const parts = removed.map((r) => `${r.name}'s “${r.label}”`);
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
