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

Open **`/demo`** (the presenter's panel) and **`/stage`** (the projector). On `/demo`:
**Reset everything**, then **Pre-queue Dev, Ana, Kai, Zoe**. Pick a pace (Stage is good).

1. **One sentence (Maya's phone).** Events → *Rooftop Sunset Session* → **Find my party**.
   Type `chill people, out by eleven, under twenty bucks, nowhere I have to drink`. Her private
   preview shows "Done by 11 PM · $20 or less · No drink minimum" and the lines she approves.
   (Or let her queue for **Anywhere tonight**, or bring a friend.)
2. **The table (projector).** Five agents, each seeing only its own person. The rooftop, the
   late synth show and the $45 supper go **unavailable**: red on the private column, with no
   reason and no name on the shared one. Kai holds a round, then concedes. Five signatures
   land; the Dolores Night Market locks. Scrub back to show any moment.
3. **MATCH FOUND** on all five phones at once, with a chime (use `/phones` and real phones:
   each scans a QR code; the board shows each phone's lag in ms).
4. **Maya's secret.** On her `/party`: her rules in her own words, and "What the party knows":
   **Nothing**, computed by scanning everything the other four can load. "Why this plan" shows
   her own checks and everyone else's only as "all passed".
5. **The chat** opens with the plan pinned and one suggested opener each.
6. **At the door.** On `/demo`, **Dev arrives** (or switch to the recorded clip and open
   `/door/glasses`): his card says how they're tied ("You have a friend in common"), what they
   share, and what to say. Nothing is inferred from a face.
7. **After.** `/runitback`: private picks; only mutual pairs are revealed; three who all picked
   each other become a standing party; everyone else sees the same "queue again" card.
8. **Why it's built this way.** `/how`: one diagram of what each piece sees and where code
   decides. `/evals`: the leak test four ways (one prompt, one prompt + verifier, five agents +
   verifier, a code solver).

If a live model is slow, **Lock now** on `/demo` makes code pick the best plan that passes
everyone's rules. `npm run test:demo` runs the core path with five browser contexts; a
60-second recording is at `shots/demo.webm` (`npm run video`).

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
npm test                       # 133 unit tests (vitest)
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
