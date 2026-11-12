/**
 * What code guarantees, for /how (F29): each claim, how it's enforced,
 * where in the app you can check it yourself, and the test that proves it.
 * A unit test keeps every href and test path real.
 */
export interface Guarantee {
  title: string;
  how: string;
  see: { label: string; href: string };
  test: string;
}

export const GUARANTEES: Guarantee[] = [
  {
    title: "A rejected plan reaches the table only as “unavailable”",
    how: "The event's schema has no field for a reason, and every event is validated before it is sent.",
    see: { label: "The shared lane on the projector", href: "/stage" },
    test: "tests/unit/agents.test.ts",
  },
  {
    title: "Your private words never reach another member",
    how: "Every event has an audience; Maya's “What the party knows” is computed by scanning everything the other four can load.",
    see: { label: "Maya's secret", href: "/party" },
    test: "tests/unit/secret.test.ts",
  },
  {
    title: "Each agent's prompt holds its own brief and nobody else's",
    how: "Code checks every prompt for other members' private words before the call. Tap a turn's chip for the exact prompt.",
    see: { label: "“Own brief only ✓” on the projector", href: "/stage" },
    test: "tests/unit/audit.test.ts",
  },
  {
    title: "Public lines come only from approved lines or neutral phrases",
    how: "A verifier in code blocks anything else, whoever typed it.",
    see: { label: "Try to leak it, on the projector", href: "/stage" },
    test: "tests/unit/leak.test.ts",
  },
  {
    title: "Code beats the model on every hard rule",
    how: "End time, budget, drink minimum and public venue are checked after every turn, even when every agent misbehaves.",
    see: { label: "Rogue model, on the demo panel", href: "/demo" },
    test: "tests/unit/rogue.test.ts",
  },
  {
    title: "Every machine-written sentence maps to an approved fact",
    how: "The model picks fact ids; code writes the sentence. Tap “Why this?” under any card.",
    see: { label: "Why this? at the door", href: "/door" },
    test: "tests/unit/provenance.test.ts",
  },
  {
    title: "No third person is named without opting in",
    how: "“You have a friend in common” unless that friend is in the party and agreed.",
    see: { label: "The ties on your party", href: "/party" },
    test: "tests/unit/bridges.test.ts",
  },
  {
    title: "Nothing is inferred from a face",
    how: "The door can only name a party member who opted in, or nobody.",
    see: { label: "At the door", href: "/door" },
    test: "tests/unit/door.test.ts",
  },
  {
    title: "When nothing fits, nobody is blamed",
    how: "The no-match event can't carry a reason or a name; everyone goes back to the front of the queue, and those five never re-form.",
    see: { label: "Show a no-match, on the demo panel", href: "/demo" },
    test: "tests/unit/nomatch.test.ts",
  },
  {
    title: "You can make the server forget your night",
    how: "Your sentence, rules, reasons and prompts are deleted, then code scans every stored value for your words.",
    see: { label: "Forget my night", href: "/safety" },
    test: "tests/unit/forget.test.ts",
  },
  {
    title: "Sandboxes never touch the live party",
    how: "“What if” and preflight run in their own store on the mock model: no real calls, no events, nothing live changed.",
    see: { label: "What if… on the projector", href: "/stage" },
    test: "tests/unit/whatif.test.ts",
  },
  {
    title: "Consent can be taken back",
    how: "Stop sharing a fact and every card, opener and line built from it is rewritten on everyone's phone, including what phones replay.",
    see: { label: "Stop sharing, on your data page", href: "/me" },
    test: "tests/unit/revoke.test.ts",
  },
  {
    title: "The room can watch without anything leaking",
    how: "The room's view is sanitized on the server: anonymous seats, code's rows, no names, no words; a test records its live stream.",
    see: { label: "The room's view", href: "/stage?screen=room" },
    test: "tests/unit/followalong.test.ts",
  },
];
