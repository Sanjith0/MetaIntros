# AGENTS.md

For every coding agent and person working here. `CLAUDE.md` imports this file.

## What this is
Queue Up is a hackathon prototype of a Facebook Events feature: queue for an event, get matched into a
small squad going together, meet in a squad chat with an AI host. Next.js 15 App Router, Prisma on
SQLite, Tailwind 4, pnpm. Seeded data only; it never calls, scrapes or logs in to Facebook.

## Read before you edit
- Anything visual: [DESIGN.md](DESIGN.md), "Read this first" and the page templates. Every part is live at `/design`.
- Any words a user sees: [PRODUCT.md](PRODUCT.md), vocabulary and voice.
- Start of every task, and before every merge: `scripts/board inbox`. Answer what is addressed to you first.

## Prove your work
```sh
pnpm install --frozen-lockfile
pnpm test          # typecheck + lint + unit tests; CI runs it on every PR and push to main
pnpm test:e2e      # Playwright, iPhone 14, production build, offline; E2E_PORT=3160 if 3100 is taken
```
`tests/e2e/screens.spec.ts` writes screenshots to `.screens/` (gitignored). Tracked `docs/screens/`
changes only with `UPDATE_SCREENS=1`, in a commit whose title starts with `screens:` (CI checks).

## Hot files
Each changed in 3 or more of the last 6 merged PRs. `scripts/board claim` it before you edit it.
- `prisma/schema.prisma`, `lib/domain/enums.ts`
- `lib/server/queue.ts`, `lib/server/host.ts`, `lib/server/notifications.ts`
- `components/queue/QueueScreen.tsx`, `components/queue/QueueSetup.tsx`
- `app/demo/page.tsx`, `app/(app)/notifications/page.tsx`, `tests/unit/host.test.ts`

Shared contracts: `prisma/schema.prisma`, `prisma/migrations/`, `lib/domain/enums.ts`, `components/fb/`,
`app/globals.css`, DESIGN.md, PRODUCT.md, AGENTS.md. Changing one needs a PR labelled `contract-change`
and an ask to every open PR it affects. `scripts/board inbox` tells you when main changes one.

## The board
GitHub issues and PR comments, driven by `scripts/board` (git and `gh` only). Full guide: [docs/BOARD.md](docs/BOARD.md).
`inbox` what needs you · `radar` who overlaps you · `ask` · `answer` · `challenge` · `escalate` ·
`claim` · `claims` · `handoff` (fills your PR description).

1. Five kinds of message only: ASK, ANSWER, CHALLENGE, CLAIM, HANDOFF. No status updates, greetings or
   thanks. Status is the pull request, CI and `scripts/board claims`.
2. Evidence or it is ignored. Every ask, answer and challenge cites what was read (file:line, commit,
   pull request) or run, and ends with "Not checked: ...". Agreeing without reading the code is not allowed.
3. Nobody waits. Every ask names a default that is reversible and keeps both sides' features, and a
   deadline 10 minutes out. After the deadline, do the default and record it in your pull request.
4. Accepting a challenge takes the same evidence as making one: recheck the code and say what you rechecked.
5. One exchange per disagreement. Still disagree? `scripts/board escalate`: label `needs-human`, assign
   the owner, each position in five lines or fewer.
6. At most three open asks per branch, 120 words each. Link to context, never paste it.
7. People decide priorities, removals and anything that cannot be undone.

## Merge steps
a. Before editing a hot file, `scripts/board claim <path> --until HH:MM --why "..."`.
b. Before opening a PR, and again before merging: `git fetch origin && git merge origin/main`, then
   `scripts/board radar`, and read the HANDOFF of every pull request it names.
c. Sort each conflict. Textual, where both changes survive: resolve it and note it. Behavioural, where
   one side's behaviour has to change or go: stop, `scripts/board ask` that side with the two options
   and your default, and carry on with other work.
d. Never resolve a conflict by deleting the other side's feature, test or migration. Never edit a
   merged migration: add a new one. Never commit regenerated screenshots.
e. The PR description is the HANDOFF ([template](.github/pull_request_template.md); `scripts/board handoff`
   drafts it from your diff): what changed, files and hot files touched, schema or contract changes,
   screens touched, the exact commands that verify it, each conflict with how it was resolved and who
   confirmed it, open asks, and what was not checked.
f. Review findings each get "fixed", "debatable" or "invalid" with a reason. Two rounds at most, then `needs-human`.
g. Touching the interface? Before the PR, run the `design-reviewer` subagent on your diff and fresh
   screenshots (`.claude/agents/design-reviewer.md`). Where subagents don't load, follow that file yourself.

## Where the hooks run
`.claude/settings.json` runs the board for you: SessionStart → `inbox`; every prompt → `inbox --new`;
after tool batches → new items at most every 5 minutes; Stop → blocks once while an ask to your branch is
open. What the Claude Code docs say (checked 2026-11-12, code.claude.com/docs):
- Laptop sessions and single-repo cloud sessions run these committed hooks.
- Project cloud threads (`claude/project-thread-*` branches) do not. They load `CLAUDE.md`, and so
  this file, but not hooks, permissions or `.claude/agents/` from the repo.
- In cloud sessions `gh issue` and `gh pr` fail, because the GitHub proxy rejects GraphQL. `gh api`
  (REST) works, and `scripts/board` uses only that.
So everywhere, hooks or not: run `scripts/board inbox` at the start of a task and before every merge.

## Owners
From PR authors and git history on 2026-11-12. People: please correct this table.

| Branch or area | Ask |
|---|---|
| Repo admin; `sanjith-people-matching` | @Sanjith0 |
| Merging PRs; `claude/project-thread-*` cloud threads; `feat/party-queue-mvp` | @TheMuffinMan1320 |
| `adi-agent-design` (Companion engine) | @Ekansh236 (its commits), @Aditya-Yan (branch) |
| `adi-initial` (queue engine, agents, global clock) | @Aditya-Yan |
| `synth/fb-shell`, `swarit-*`; `components/fb/`, DESIGN.md, PRODUCT.md, the board | @swarit-1 |
| `ekansh` (initial commit only) | @Ekansh236? |
