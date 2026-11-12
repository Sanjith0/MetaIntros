# Party Queue

**Hackathon prototype, not Facebook.** Seeded, fictional data only. The app never calls,
scrapes or logs in to Facebook, has no login screen, and uses no Meta logos, icons, fonts,
images or code.

Party Queue is a set of layers on surfaces people already use: the Event page, the Events tab,
group chat and notifications. You tap **Find my party** on an Event, type one sentence, and
leave. Code forms a party of five who each share a mutual friend or a small Group with
someone in it. Five AI agents, each seeing only its own person's brief, settle the plan at a
shared table; plans that break someone's private rule show only as "unavailable". Code locks
the plan, all five phones show **MATCH FOUND** at once, the plan becomes an RSVP, a group
chat opens with the plan pinned and one opener per person, a card at the door says who is in
front of you and what to say, and afterwards only mutual "run it back" picks are shown.

How it works, and where privacy is enforced: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Devpost draft: [docs/DEVPOST.md](docs/DEVPOST.md). Every feature and its proof:
[FEATURES.md](FEATURES.md). Milestones and checks: [SCORECARD.md](SCORECARD.md).

## For judges: what to check, and where

Each of these works in the app and has a test; `/how` links to all of them.

| Claim | See it |
|---|---|
| Each agent knows only its own person | `/stage`: tap any turn's **own brief only ✓** for the exact prompt it got |
| A broken rule reaches the others only as "unavailable" | `/stage` shared lane; Maya's `/party` → "What the party knows: Nothing", computed by scanning what the other four can load |
| Safety doesn't depend on the model behaving | `/demo` → **Rogue model**: every agent says yes to everything and tries to leak; code still locks a valid plan |
| You can try to break it | `/stage` → **Try to leak it**: type a leak as any agent and watch the verifier stop it |
| Rules decide which plans are open | `/stage` → **What if…**: take rules away and re-run the same five in a sandbox |
| Every machine-written line is grounded | **Why this?** under any card, door card or chat opener |
| The room can watch without anything leaking | `/stage` → **Public screen**, then scan the QR: the room's view is sanitized on the server |
| Nothing is kept longer than the night | `/safety` → **Forget my night**, or wait: it's deleted when the chat closes; `/me` lists everything held about you |
| Consent can be taken back | `/me` → **Stop sharing** a fact: every card and line built from it is rewritten on everyone's phone; your consent history is there too |
| When things go wrong, nobody is blamed | `/demo` → **Show a no-match**; `/party` → **Can't make it?** (the seat is refilled), **Switch to plan B** (three of five ask), **Leave quietly** at the door |
| It scales | `/evals` → **At fair scale**: 100 guests, 20 parties, every plan valid, 0 leaks |

## Run it

```bash
npm install
npm run dev                      # http://localhost:3000
npm run dev:lan                  # same, reachable from phones on the same Wi-Fi
```

No key is needed: without `META_API_KEY` the model client runs a deterministic mock. To use the
Meta Model API, copy `.env.example` to `.env.local` and set `META_API_KEY`,
`META_API_BASE_URL`, `MUSE_SPARK_MODEL` and `MUSE_EMBER_MODEL`. Real calls are capped at 300
per night (`MODEL_CALL_CAP`); the key is never printed or logged. `npm run talk:real` times one
real table talk; `npm run record` saves a run for the recorded replay.

## The five-minute demo

Open **`/demo`** (the presenter's panel) and **`/stage`** (the projector). On `/demo`, run
**Preflight** first: it rehearses the whole party in a sandbox and says what to fix. The
**Run of show** below it has the same script as nine timed beats with one-click setup. On the
projector, press **?** for the presenter keys (**B** for big text in a large room). Then:
**Reset everything**, then **Pre-queue Dev, Ana, Kai, Zoe**. Pick a pace (Stage is good).

1. **One sentence (Maya's phone).** Events → *Rooftop Sunset Session* → **Find my party**.
   Type `chill people, out by eleven, under twenty bucks, nowhere I have to drink`. Her private
   preview shows "Done by 11 PM · $20 or less · No drink minimum" and the lines she approves.
   (Or let her queue for **Anywhere tonight**, or bring a friend.)
2. **The table (projector).** Five agents, each seeing only its own person. The rooftop, the
   late synth show and the $45 supper go **unavailable**: red on the private column, with no
   reason and no name on the shared one. Kai holds a round, then concedes. Five signatures
   land; the Dolores Night Market locks. Scrub back to show any moment.
   Tap any agent's **own brief only ✓** chip to show the exact prompt it got. Then **Try to
   leak it**: type Maya's limits as Dev's agent and watch the verifier block it, live.
   **What if…** takes rules away and re-runs the same five in a sandbox: without Maya's drink
   rule the rooftop opens; the late show needs both curfews gone; the market still wins.
3. **MATCH FOUND** on all five phones at once, with a chime (use `/phones` and real phones:
   each scans a QR code; the board shows each phone's lag in ms).
4. **Maya's secret.** On her `/party`: her rules in her own words, and "What the party knows":
   **Nothing**, computed by scanning everything the other four can load. "Why this plan" shows
   her own checks and everyone else's only as "all passed".
5. **The chat** opens with the plan pinned and one suggested opener each.
6. **At the door.** On `/demo`, **Dev arrives** (or switch to the recorded clip and open
   `/door/glasses`): his card says how they're tied ("You have a friend in common"), what they
   share, and what to say. Nothing is inferred from a face. **Why this?** under the card lists
   the approved facts it was written from, and whose they are.
7. **After.** `/runitback`: private picks; only mutual pairs are revealed; three who all picked
   each other become a standing party; everyone else sees the same "queue again" card. On
   `/safety`, **Forget my night** deletes Maya's private data from the night, then scans every
   value on the server: none of her words remain. **Standing party queues again (Sun)** on
   `/demo` sets up the next beat: Dev and Ana queue for Sunday with their standing party; Maya
   taps the invite, types her own sentence, and the three land in one party with two new people.
8. **Why it's built this way.** `/how`: one diagram of what each piece sees and where code
   decides, and 13 guarantees, each with a **See it** link to where it works in the app. `/evals`: the leak test four ways (one prompt, one prompt + verifier, five agents +
   verifier, a code solver).

**If nothing fits:** on `/demo`, **Show a no-match (rules clash)** queues the five with Ana's curfew
and Zoe's budget changed so no plan works for all of them. The projector says **No match**;
every phone says no plan fit all five, nobody was told whose rules clashed, and they're back at
the front of the queue (never with these same five again).

**If the model misbehaves:** on `/demo`, turn **Rogue model** on and start the party again.
Every agent says yes to every plan and tries to tell the table its person's rules. The stage
shows "Code overrode the model" on each bad yes and "Verifier blocked" on each line; the market
still locks with five signatures, and Maya's "What the party knows" still says Nothing.

If a live model is slow, **Lock now** on `/demo` makes code pick the best plan that passes
everyone's rules. `npm run test:demo` runs the core path with five browser contexts; a
60-second recording is at `shots/demo.webm` (`npm run video`): Maya's phone from the Events
tab to run it back, ending on the projector as Dev's agent tries to leak her limits.

## Layers (all in `lib/flags.ts`)

Every phase-2 feature is a layer behind a flag, on by default except voice. Switch any of them
live from `/demo` → Layers, or with `PQ_FLAG_<NAME>=0|1`.

| Flag | What it adds |
|---|---|
| `STAGE_SCRUBBER` | `/stage` replay with a scrubber: rejections in red, holds in amber, signatures landing, per-agent latency |
| `SECRET_PANEL` | Maya's secret: your rules and receipt beside a computed "what the party knows" |
| `REAL_PHONES` | `/phones`: QR join on the local network, presence, server-clock acks, sound unlock, vibration |
| `MODEL_READINESS` | streamed verdicts, latency per agent, labelled fallbacks on timeout, labelled recorded replays |
| `DEMO_PANEL` | `/demo` presenter controls |
| `DUO_QUEUE` | bring a friend (both land in one party); women-only and not-the-only-woman in the queue sheet |
| `BRIDGE_PRIVACY` | ties shown without naming a third person who never opted in |
| `CHAT_LIFECYCLE` | I'm here pings, leaving before the lock without attribution, chats that close after the event |
| `GLASSES_VIEW` | `/door/glasses` heads-up view, and a recorded-clip frame source labelled as recorded |
| `RUN_IT_BACK_PLUS` | a private chat per mutual pair, one identical queue-again card, standing parties |
| `FAIR_HOST` | `/fair/host` live counts (guests, queued, parties, locked, met), counts only |
| `EVALS_PAGE` | `/evals`: the leak test four ways |
| `WHY_PLAN` | "why this plan", built only from code checks |
| `NIGHT_QUEUE` | queue for the whole night: any landmark that evening, any of its events |
| `SAFETY_PAGE` | `/safety`: what code enforces, block, leave, report (the reported person is never told) |
| `VOICE_SENTENCE` | **off by default**: say your sentence instead of typing it |
| `UX_STATES` | skip link, MATCH FOUND focus and Escape, chat send retry |
| `HOW_PAGE` | `/how`: the architecture diagram and what code guarantees |
| `CONTEXT_AUDIT` | every agent prompt checked by code for other members' private words; per-turn chip and the exact prompt on `/stage` |
| `LEAK_TEST` | **Try to leak it** on `/stage`: type a line as any agent; the verifier blocks it live, and nothing reaches a phone |
| `WHAT_IF` | **What if…** on `/stage` after the lock: take rules away and re-run the same five in a sandbox (mock model, nothing live touched) |
| `WHY_LINE` | **Why this?** under every opener on `/party` and on the door card: the approved facts each line came from, in plain words (no ids, no unnamed third person) |
| `FORGET_ME` | **Forget my night** on `/safety` after the plan is set: deletes your sentence, rules, private reasons, prompts, checks and receipt, then scans every value on the server for your words |
| `PREFLIGHT` | **Preflight** on `/demo`: rehearses the demo party in a sandbox and checks layers, model and call budget, pace, privacy, live state, screens and fallbacks |
| `STANDING_QUEUE` | a standing party (3+ who all picked each other) queues together again from `/runitback`: one invite each, they wait for each other, land in one party with new people, and each types their own sentence |
| `ROGUE_MODE` | **Rogue model** switch on `/demo` (off by default): every agent says yes to everything and tries to tell the table its person's rules; the stage shows code overriding each bad yes and the verifier blocking each line |
| `STAGE_PARTIES` | a party switcher on `/stage` once there's more than one: "Sun · Ferry Building · talking"; pin one (kept in the URL) or follow new parties |
| `PROOF_HUB` | `/how` as a proof hub: each of 13 guarantees links to where it can be seen working in the app and names its test |
| `SCALE_TEST` | **At fair scale** on `/evals`: 50, 100 or 200 fictional guests through the real loop in a sandbox; parties, timing, lock-to-MATCH FOUND, invalid plans, leaks, real calls |
| `AGENT_STORY` | "How your agent did it" in your receipt: your own agent's moves round by round (turned down, held out, agreed, signed) and where code stepped in |
| `CHAT_WHY` | **Why this?** in the group chat too: under the pinned plan and each suggested opener |
| `STAGE_CAPTIONS` | a big caption on `/stage` saying what just happened in plain words ("Kai's agent is holding out for Open Studio: Clay and Tea."); follows the scrubber; never quotes anyone's private words |
| `EDIT_SENTENCE` | change your sentence while you wait in the queue: a new private preview, the brief rebuilt, and you keep your place in line |
| `RUN_OF_SHOW` | **Run of show** on `/demo`: nine timed beats to 5:00, the line to say, where to show it, one-click setup; a clock highlights the current beat and says when you're over |
| `TELL_A_FRIEND` | "Tell a friend where you'll be" on `/party`: a message for someone outside the app with the place, the time and when you'll check in; names nobody; copy or share, nothing is sent |
| `FIND_EACH_OTHER` | "Find each other" on `/door`: running late (10, 20 or 30 min) and where we meet, live on everyone's door screen and in the chat; arriving clears "late" |
| `ADD_TO_CALENDAR` | **Add to calendar** on the party card: the locked plan as an `.ics` file (local times; after midnight ends the next day; names nobody) |
| `AGENT_MEMORY` | your agent remembers, with your OK: after the night, "Loved it" or "Too loud" becomes preferences you tick ("prefers quiet"); next time they're in your private preview, preferences only, never rules; you can leave them out or make it forget |
| `MY_DATA` | `/me`, "Your data": everything Party Queue holds about you (profile facts, sentence and brief, queue, parties, memory, picks, blocks and reports, messages), where to change each, and a JSON download |
| `PUBLIC_SCREEN` | **Public screen** on `/stage` (`?screen=public`): for a screen the whole room can see; plans, a signature count, code's rows and captions only: no names, no reasons, no one's words |
| `SEAT_REFILL` | **Can't make it?** on `/party` after the lock: the plan stands; someone waiting nearby whose own rules pass it, and who fits the party, takes the seat (their agent meets the other four); the others are told one person couldn't make it, never who |
| `AUTO_FORGET` | forget by default: every member's private data from a night (sentence, rules, reasons, prompts) is deleted automatically when the party chat closes, 12 hours after the event, unless you choose "Keep it instead" on `/safety` |
| `FRIEND_GROUP` | bring up to three friends from the queue sheet: one invite each, the group waits for everyone, lands in one party with new people, and each types their own sentence |
| `CLOSEST_FIT` | when nothing there fits your own rules, your phone (only yours) names the closest plan and the change that would open it ("stay until 9:30 PM") |
| `FOLLOW_ALONG` | **Follow along**: the public projector shows a QR to `/stage?screen=room`, the room's view on any phone, enforced on the server: anonymous seats, code's rows, no bus events, no names, no words, no operator controls |
| `STAGE_KEYS` | presenter keys on `/stage`: Space play/pause, ← → step (Shift: 10), Home start, L live, P public screen, C captions, 1/2/4 speed, ? the list |
| `LOCK_SPLASH` | the lock as a moment on `/stage`: a full-screen MATCH FOUND with the plan, and "2 phones showed it · slowest 6 ms after the lock" from the phones' server-clock acks; non-blocking, gone in 5 s |
| `WIDEN_SEARCH` | while waiting near one place with fewer than five, "Widen to anywhere tonight (9 events)" switches you in one tap, keeps your place in line, and tries to form a party at once |
| `SPANISH_SENTENCE` | your one sentence can be in Spanish ("salgo a las once, menos de veinte dólares, sin consumo mínimo"): the same rules and preferences, your own words kept as your words |
| `QUEUE_PULSE` | on an Event page, how many are waiting near there tonight and how many parties have formed; counts only, and "a few" under three so a count can't single anyone out |
| `STAGE_BIG` | big text on `/stage` for a large room: B (or `?big=1`) scales the whole projector up and it still fits the screen |
| `PLAN_B` | plan B: at the lock, code also names the next-best plan that fits everyone and nobody turned down, on the party card and pinned in the chat |
| `PLAN_B_SWITCH` | **Switch to plan B** on the party card: when three of the five ask, code moves the plan, the RSVPs, the chat's pin and title; the chat shows only how many asked |
| `EVENT_IMPACT` | on the Event page a party picked: "Party Queue: 1 party of five is coming tonight · 1 already here", whole parties only |
| `STORY_MEMORY` | your agent's story says when it used what it remembers ("It used what it remembers about you: prefers quiet (remembered from Dolores Night Market).") |
| `REVOKE_SHARING` | take back what you shared: on `/me`, **Stop sharing** a fact and every card, opener, pair and table line built from it is rewritten on everyone's phone (and in the replayable event log); agents can't use it again |
| `NOTIFICATIONS_LIST` | notifications, kept: a bell with an unread count in the top bar and `/notifications`, built from the events only you were sent, in the toasts' words |
| `LEAVE_QUIETLY` | **Leave quietly** on `/door`: one plain goodbye in the chat as your own message, no reason owed, "Headed home" on the others' door screens, a ready text for your friend, and a link to Safety |
| `CONSENT_HISTORY` | consent history on `/me` (and in the download): what you agreed to and when (how you're tied, lines your agent may share, memory, keeping a night) and what you took back |
| `STORY_CHANGES` | your agent's story tells what happened after the lock, in code's voice: a switch to plan B, or the open seat you took |
| `NO_MATCH` | when no plan fits all five: everyone back at the front of the queue, nobody blamed, the same five never re-form; anyone whose own rules close every plan is told privately |

## Routes

| Route | For |
|---|---|
| `/events`, `/event/[id]` | the Events tab and Event page (Interested, Going, guest list, Find my party) |
| `/queue` | the queue sheet: one sentence, a private brief preview, where, a friend, a live timer |
| `/party` | the party card, Maya's secret, why this plan, the public table, your receipt |
| `/chat/[id]` | group chat: pinned plan, openers, pings, closes after the event |
| `/door`, `/door/glasses` | at the door: I'm here, the spotted card, tap a face; the heads-up view |
| `/runitback` | private picks, mutual pairs, standing parties |
| `/fair`, `/fair/host` | QR join with a typed profile and consent; the host's live counts |
| `/safety` | what code enforces; block, leave, report |
| `/stage`, `/demo`, `/phones`, `/evals`, `/how` | projector, presenter panel, real phones, the leak test, how it works |
| `/me` | your data: everything Party Queue holds about you, where to change it, and a JSON download |
| `/notifications` | your Party Queue notifications, kept, with the unread count on the bell |

## The rules, and where code enforces them

See the table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: private rules never
leave their owner (a strict "unavailable" event, audience-filtered streams, a verifier on
every public line); code beats the model on every hard rule; every machine-written sentence
maps to fact ids its subject approved; no third person is named without opting in; nothing is
inferred from a face; no score or label about a person or a pair.

## What is stubbed

- **Model**: no key was available, so every agent call ran on the deterministic mock. The
  real client, prompts, timeouts, validation, fallbacks, latency labels and recording are in
  place. The committed recording came from the mock and says so when replayed.
- **The single-prompt baseline on `/evals` is simulated**, and labelled so.
- **Recognition**: `matchFrame` uses a stub that maps fixture keys to party members and never
  reads pixels. Plug a module in with `setMatcher()`; only a gallery member id or null gets
  through.
- **Door device identity**: `POST /api/frames` trusts the frame's `viewerId`.
- **Voice** uses the browser's own speech recognition, off by default.
- **Reports** go to an in-memory review store; there is no review tool yet.
- **State is in memory**: a restart or **Reset everything** clears it.
- **Inert shell pieces**: search, Invite, Share, the overflow menu, the Discussion tab, the map.
- **Facebook reference**: the logged-in states were behind a login, so they are inferred
  (see `SCORECARD.md`).

## Tests and checks

```bash
npm run typecheck
npm test                       # 275 unit tests (vitest)
npm run contract:check         # fixtures and events against the Zod contracts
npm run eval -- --mock         # 7 eval suites
npx playwright install chromium  # once, for the browser tests
npm run test:e2e               # every Playwright spec (screenshots in shots/)
npm run test:demo              # the five-context demo path
```

Playwright runs against a production build: it runs `next build`, starts `next start` on port
3210, and stops it afterwards, so every run starts cold. `PQ_REUSE=1` reuses a server already
on that port; `PQ_DEV=1` runs against `next dev`. Specs include five phones at once, every
route at 390 px, and axe accessibility checks on every main route. CI
(`.github/workflows/ci.yml`) runs typecheck, unit tests and the contract check on every push.

## Layout

```
contracts/   Zod schemas and the realtime event catalogue
fixtures/    40 fictional profiles, friend graph, Groups, 15 events, the demo party, frames, a recorded run
model/       the model client (mock by default), runtime settings, recordings
lib/agents/  brief, agent turns, table talk, judge, verifier, pair talk, orchestrator
lib/queue/   party formation rules
lib/server/  store, event bus, queue, views, door, chat lifecycle, secret, why, fair, safety, phones
lib/stage/   the board behind the stage scrubber
lib/evals/   the four-way leak comparison
lib/flags.ts the flags file
app/         routes and API handlers
evals/       eval harness, cases and PLAN.md
docs/        architecture and the Devpost draft
reference/   the Facebook reference written from REA
tests/       unit (vitest) and Playwright specs
```

## Troubleshooting

- Pages reload in a loop in development: the dev server's hot-reload state is stuck. Stop it,
  `rm -rf .next`, start again.
- `npm ci` fails in CI after adding a package: npm on macOS can drop Linux-only optional
  packages. Regenerate with `rm -rf node_modules package-lock.json && npm install` (a unit test
  checks for this).
