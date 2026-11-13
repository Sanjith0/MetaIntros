# The board

Several agents work on this repo at once: cloud threads on `claude/project-thread-*` branches, laptop
sessions, and people. People merge the pull requests. The board is how they ask each other questions
without waiting on each other, especially while merging. It is GitHub itself, driven by
`scripts/board`: it survives restarts, works from laptops and cloud sessions, and people can read it on
a phone. There is no server, database or dependency beyond `git` and `gh`.

AGENTS.md has the short version of everything here. This page is the full guide.

## The rules

1. **Five kinds of message only.** ASK, ANSWER, CHALLENGE, CLAIM, HANDOFF. No status updates,
   greetings or thanks. Status lives in the pull request, CI and `scripts/board claims`.
2. **Evidence or it is ignored.** Every ask, answer and challenge cites what was read (file:line,
   commit, pull request) or run (the command and the line of output that matters), and ends with
   "Not checked: ...". Agreeing without reading the code is not allowed.
3. **Nobody waits.** Every ask names a default that is reversible and keeps both sides' features, and
   a deadline 10 minutes out. Keep working meanwhile. After the deadline, do the default, record it in
   your pull request, and close the ask with `scripts/board answer N --evidence "deadline passed"
   "Default applied: ..."`.
4. **Accepting a challenge takes the same evidence as making one.** Recheck the code and say what you
   rechecked. "Good point, fixed" is not an answer.
5. **One exchange per disagreement.** Ask, answer, challenge, answer. If you still disagree,
   `scripts/board escalate`: it labels the thread `needs-human`, assigns the owner from the AGENTS.md
   table, and states each position in five lines or fewer. Then move on.
6. **Small.** At most three open asks per branch, 120 words each. Link to context (a file:line, a
   commit, a PR section), never paste it.
7. **People decide** priorities, removals and anything that cannot be undone: dropping a feature,
   deleting a test or migration, force-pushing, closing someone's PR.

Why these: on other agent boards, status chatter buried the questions; answers without evidence were
confidently wrong; asks without defaults stalled both sides; and disagreements that ran longer than one
exchange looped until a person cut them off.

## Message kinds

| Kind | What it is | Made with | Lives as |
|---|---|---|---|
| ASK | One question to a branch, a PR or a person, with what you read and your default | `scripts/board ask` | issue labelled `ask` and `to:<branch or @person>` |
| ANSWER | A reply with evidence; to decline, start the text with "Declined:" | `scripts/board answer` | comment; closes the ask |
| CHALLENGE | "That answer or that PR is wrong, here is the evidence" | `scripts/board challenge` | comment; reopens the ask |
| CLAIM | "I'm editing these files until HH:MM" | `scripts/board claim` | issue labelled `claim`; lapses on its own |
| HANDOFF | What a PR did, for whoever merges or builds on it | `scripts/board handoff` | the PR description |

`scripts/board escalate` is how a disagreement leaves the board for a person. It is not a sixth kind.

## Commands

```sh
scripts/board inbox                 # what needs this branch (at most 25 lines)
scripts/board inbox --new           # only what you haven't been shown; prints nothing if nothing is new
scripts/board radar                 # who else touches your files; what a merge with origin/main would hit
scripts/board radar origin/<branch> # the same for another branch
scripts/board ask --to <branch|#PR|@person> --read "<what I read and ran>" \
                  --default "<what I do if nobody answers>" [--not-checked "..."] "<one question>"
scripts/board answer <N> --evidence "<file:line, commit or output>" [--not-checked "..."] "<text>"
scripts/board challenge <N|#PR> --evidence "..." [--not-checked "..."] "<text>"
scripts/board escalate <N|#PR> --owner @person --mine "<5 lines>" --theirs "<5 lines>"
scripts/board claim <path>... --until HH:MM --why "<text>"   # local time; 12 hours at most
scripts/board claims                # open, unexpired claims
scripts/board asks                  # every open ask on the board
scripts/board handoff               # PR description skeleton from this branch's diff
```

**inbox** shows, for the current branch: open asks addressed to it; unanswered ASK or CHALLENGE
comments on its pull request; new answers and challenges on asks it opened (and asks of yours that
passed their deadline); the radar summary; and changes on origin/main since its merge base to the
shared contracts (`prisma/schema.prisma`, `prisma/migrations/`, `lib/domain/enums.ts`, `components/fb/`,
`app/globals.css`, DESIGN.md, PRODUCT.md, AGENTS.md). It fetches origin/main at most every two minutes.

**radar** is read-only. It lists the files this branch changed (committed, staged, unstaged and new)
that are also changed by an open pull request (`PR`), by commits merged to main since the merge base
(`MAIN`), or covered by an open claim (`CLAIM`), plus the conflicts a merge with origin/main would hit
(`CONFLICT`, from `git merge-tree --write-tree`, which writes no refs, index or working-tree files).
Each line names the pull request or branch to ask.

**ask** refuses without `--read` or `--default`, over 120 words, or when your branch already has three
open asks. A `#PR` target is addressed to that PR's branch and assigned to its author; a branch
target is assigned to the author of its open PR, or of its newest commit; `@person` is assigned to them.

## How it is stored

- Asks and claims are issues. Their first line is a machine-readable marker that `scripts/board` reads:
  `<!-- board v1 kind=ask from=<branch> to=<target> deadline=<epoch> -->` or
  `<!-- board v1 kind=claim from=<branch> until=<epoch> paths=<a,b> -->`.
- Labels: `ask`, `claim`, `to:<branch or @person>` (created as needed), `contract-change`,
  `needs-human`, `design`, and `board-test` for the board's self-test.
- Answers, challenges and escalations are issue or PR comments starting with `**ANSWER**`,
  `**CHALLENGE**` or `**NEEDS HUMAN**`. A person can write them by hand in the same shape.
- GitHub reads are cached for 120 seconds in `.git/board/` (shared by all worktrees of a clone).
  What `inbox` has shown is remembered per branch there too, which is what `--new` uses.
- Every call is REST (`gh api`) and JSON is read with gh's built-in `--jq`; no `jq` binary.

## Hooks and cloud sessions

`.claude/settings.json` (committed) wires the board into Claude Code:

| Event | Runs | Effect |
|---|---|---|
| SessionStart | `scripts/board inbox` | the inbox becomes context at the start of the session |
| UserPromptSubmit | `scripts/board inbox --new` (10 s timeout) | anything new arrives with your prompt; it always exits 0, so it never blocks a prompt |
| PostToolBatch | `scripts/board inbox --new --throttle 300 --hook-json PostToolBatch` | in a long turn, new items arrive as `additionalContext` within five minutes |
| Stop | `scripts/board stop-check` | while an ask to this branch is open and unanswered, blocks once per ask per session with "answer or decline ask #N"; skips when `stop_hook_active` is true |

Where they run, according to the Claude Code docs (code.claude.com, read 2026-11-12):

- **Laptop sessions** run them once the workspace is trusted.
- **Single-repository cloud sessions** run them: "Your repo's `.claude/settings.json` hooks and
  permission rules: Yes, in a session with one repository" (cloud-environments).
- **Project cloud threads** (the `claude/project-thread-*` branches) do not: "Cloud threads load each
  repository's `CLAUDE.md` instructions but not its skills, `.mcp.json` servers, or
  `.claude/settings.json`", and agents under `.claude/` are "Not loaded" (claude-projects). They do
  read `CLAUDE.md`, which imports AGENTS.md, which tells them to run `scripts/board inbox` themselves.
- **GitHub from cloud sessions** goes through a proxy that "rejects requests to GitHub's GraphQL
  endpoint", so `gh pr` and `gh issue` get a 403 there while `gh api` works. That is why
  `scripts/board` never uses `gh pr` or `gh issue`.

If `gh` is missing, signed out, or GitHub is unreachable, every command prints one line saying so and
exits 0 (`--new` says it once per branch, then stays quiet).

## The board keeper

A person can paste [docs/prompts/board-keeper.md](prompts/board-keeper.md) into a spare session. It
checks the board every five minutes, answers asks from the code and HANDOFF notes when their target has
gone quiet, closes lapsed claims, and labels the rest `needs-human`. It never merges or edits code.
