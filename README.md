# Party Queue

**Hackathon prototype, not Facebook.** Seeded, fictional data only. The app never calls,
scrapes or logs in to Facebook, has no login screen, and uses no Meta logos, icons, fonts,
images or code.

Party Queue is a set of layers on surfaces Facebook already has: the Event page, the Events
tab, Messenger group chat and notifications. You tap **Find my party** on an Event, type one
sentence, and leave. Code forms a party of five people who each share a mutual friend or a
small Group with someone in it. Each person's AI agent sees only its own person's brief. The
agents settle the plan at a shared table and, in pairs, find what two people have in common.
Code locks the plan all five accept, and all five phones show **MATCH FOUND** at once. The
plan becomes an RSVP, a group chat opens with the plan pinned and one opener per person, a
card at the door tells you who is in front of you and what to say, and afterwards only mutual
"run it back" picks are shown.

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
```

No key is needed: without `META_API_KEY` the model client runs a deterministic mock. To use the
Meta Model API, copy `.env.example` to `.env.local` and fill in `META_API_KEY`,
`META_API_BASE_URL`, `MUSE_SPARK_MODEL` and `MUSE_EMBER_MODEL`. Real calls are capped at 300
per night (`MODEL_CALL_CAP`); the key is never printed or logged.

`PQ_PACE_MS` (default 600) slows the agents' talk so the stage can show it live. Set it to 0
for instant results.

## The demo path

**One browser, about two minutes.** Use the user switcher (top right) to change who you are.

1. Open the projector view at `/stage` in a second window and click **Start demo party**, or
   follow the steps below to drive it from Maya's phone.
2. To drive it by hand, queue the other four first:
   `curl -X POST localhost:3000/api/demo/start -H 'content-type: application/json' -d '{"mode":"four"}'`
3. As **Maya**, open **Rooftop Sunset Session** from the Events tab and tap **Find my party**.
   Type `chill people, out by eleven, under twenty bucks, nowhere I have to drink`. The private
   preview shows her rules (done by 11 PM, $20 or less, no drink minimum) and the lines she
   may share. Tap **Find my party**.
4. The party forms. Tap **Watch your party** to see the table fill in: three plans go
   "unavailable" (with no reason), Kai holds for one round, then all five sign the
   **Dolores Night Market**.
5. **MATCH FOUND** appears with a chime. Open the group chat: the plan is pinned and each
   person has one suggested opener. `/party` shows the party card and Maya's private receipt.
   The Night Market's Event page shows **Your party · 5 going**.
6. Open `/door`, tap **I'm here**, then post the fixture frame (`fixtures/frames/dev-at-door.json`)
   with `curl -X POST localhost:3000/api/demo/frame`. Dev's card appears: how you're
   connected, what you have in common, and what to say. (`POST /api/frames` takes any Frame
   directly.)
7. Open `/runitback`, pick people privately, and see only the mutual pairs. `/fair` shows the
   QR join with a typed profile and a consent box.

**Automated:** `npm run test:demo` runs the same path with five browser contexts and checks
that all five show MATCH FOUND within 2 seconds of `plan.locked`, with sound. A 60-second
recording is at `shots/demo.webm` (`npm run video` re-records it).

`POST /api/demo/reset` clears all state.

## What works

- **Facebook layer** (`/events`, `/event/[id]`, `/chat/[id]`): our own components built from
  `reference/EVENT_PAGE.md` and `reference/MESSENGER_CHAT.md`; Interested/Going, guest list
  dialog, Messenger-style bubbles and composer, live toasts, the demo user switcher. `noindex`
  on every page (meta tag and `X-Robots-Tag`).
- **Queue and formation** (`lib/queue/formation.ts`): landmark buckets, a 90-minute shared
  window, exactly five people, the bridge rule (mutual friend, or a shared Group under 200),
  women-only, not-the-only-woman, blocks, 18+. `/queue` has the sentence box, the private brief
  preview with line approvals, bridge consent and a live timer.
- **Agents** (`lib/agents/`): the brief (`brief.ts`), five agents as separate model calls that
  each see only their owner's brief and the public table (`agent.ts`, `table.ts`), code as the
  judge (`judge.ts`), the verifier (`verifier.ts`), pair talk (`pair.ts`), receipts and the lock
  (`orchestrator.ts`). `/stage` replays both conversations with private and shared columns.
- **Match found**: `plan.locked` and `match.found` go out together over SSE; the RSVP, the
  party card, the pinned plan and openers are ready before they do.
- **Door** (`lib/door/recognition.ts`, `/door`, `POST /api/frames`): I'm here, the spotted card,
  tap-a-face.
- **After**: `/runitback`, `/fair`, and `evals/` (`npm run eval -- --mock`, plan in
  `evals/PLAN.md`).

## The rules, and where code enforces them

- **Hard rules stay private.** The table only learns a plan is "unavailable";
  `plan.unavailable` is a strict schema with no reason field (`contracts/events.ts`), and the
  bus validates every event before sending it (`lib/server/bus.ts`).
- **Each browser hears only its own events.** Every event has an audience; the SSE route
  filters by it. Private reasoning goes only to its owner and the projector.
- **Public lines come only from approved lines or neutral phrases.** `verifyPublicLine`
  blocks anything else and swaps in a neutral phrase.
- **Code is the judge.** Venue, budget and end time are checked after every model turn; a
  model "accept" that breaks a rule is overridden; five signatures or a code fallback.
- **Every machine-written sentence maps to approved fact ids.** The pair agent only picks ids;
  code renders the sentence from facts the subject approved (and bridges both consented to).
- **No scores or labels about people or pairs.** Preferences (1-5) are about plans and are
  shown only to their owner.
- **Nothing is inferred from a face.** The matcher may only return a gallery member id or null.

## What is stubbed

- **Model**: no key was available, so everything ran on the deterministic mock. The real
  client, prompts, timeouts, validation and fallbacks are in place (`model/client.ts`);
  `npm run talk:real` times one real table talk when a key is set.
- **Recognition**: `matchFrame` uses a stub that maps a fixture key to a member and never reads
  pixels. Plug a module in with `setMatcher()`.
- **Door device identity**: `POST /api/frames` trusts the frame's `viewerId`.
- **State is in memory**: a server restart or `POST /api/demo/reset` clears it.
- **Inert shell pieces**: search, Invite, Share, the overflow menu, the Discussion tab and the
  map are visual only.
- **Facebook reference**: Interested/Going, the guest list and Messenger were behind a login,
  so those parts of the reference are inferred. See `SCORECARD.md`.

## Tests and checks

```bash
npm run typecheck
npm test                     # 52 unit tests (vitest)
npm test -- queue            # one failing fixture per formation rule
npm test -- agents           # the four required agent cases and more
npm run contract:check       # fixtures and events against the Zod contracts
npm run eval -- --mock       # 7 eval suites
npx playwright install chromium   # once, for the browser tests
npm run test:e2e             # all Playwright specs (screenshots in shots/)
npm run test:demo            # five-context demo path
```

Playwright reuses a dev server already running on port 3000 (Next 16 allows one dev server per
project folder), or starts one. CI (`.github/workflows/ci.yml`) runs typecheck, unit tests and
the contract check on every push.

## Layout

```
contracts/   Zod schemas and the realtime event catalogue
fixtures/    40 fictional profiles, friend graph, Groups, 15 events, the demo party, door frames
model/       the Meta Model API client (mock by default)
lib/agents/  brief, agent turns, table talk, judge, verifier, pair talk, orchestrator
lib/queue/   party formation rules
lib/server/  in-memory store, event bus, queue, views, door, after
lib/door/    the recognition interface and stub
app/         routes: /events /event/[id] /queue /party /chat/[id] /stage /door /runitback /fair
evals/       eval harness, cases and PLAN.md
reference/   the Facebook reference written from REA
tests/       unit (vitest) and Playwright specs
```

## Troubleshooting

If every page reloads in a loop in development, the dev server's hot-reload state is stuck:
stop it, run `rm -rf .next`, and start it again.
