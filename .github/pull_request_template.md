<!--
This description is the HANDOFF (AGENTS.md, merge step e). `scripts/board handoff` drafts it from your diff.
Before opening, and again before merging: git fetch origin && git merge origin/main && scripts/board radar.
-->

## What changed

-

## Files touched

**Hot files touched:** none <!-- or list each with its claim issue, e.g. `lib/server/queue.ts` (claim #12) -->

## Schema and contract changes

<!-- New migrations (never edit a merged one). Shared contracts touched: prisma/schema.prisma,
prisma/migrations/, lib/domain/enums.ts, components/fb/, app/globals.css, DESIGN.md, PRODUCT.md, AGENTS.md.
If any: label this PR contract-change and ask every open PR it affects. -->

- none

## Screens touched

<!-- Routes and states that look different, and the screens spec entries. Tracked docs/screens/ changes
only in a commit titled "screens: ...". UI changes: design-reviewer findings go under Review findings. -->

- none

## How to verify

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:e2e
```

## Conflicts with origin/main

<!-- From scripts/board radar. Textual: both sides survive. Behavioural: one side's behaviour had to change;
those need an ask and a confirmation. Never resolve by deleting the other side's feature, test or migration. -->

| File | Kind | Resolution | Confirmed by |
|---|---|---|---|
| | | | |

## Open asks

- none

## Review findings

<!-- Each finding: fixed, debatable or invalid, with a reason. Two rounds at most, then needs-human. -->

| Finding | Verdict | Reason |
|---|---|---|
| | | |

## Not checked

-
