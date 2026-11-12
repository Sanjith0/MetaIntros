# Scorecard

Branch: `swarit-baseline`. Everything runs locally with `npm install && npm run dev`.

## Milestones

| Milestone | Result | Proving command | Last lines of output |
|---|---|---|---|
| M0 Foundations | PASS | `npm run contract:check && npm test` | `contract:check PASS - 314/314 checks passed` · `Test Files  2 passed (2)` · `Tests  11 passed (11)` |
| M1 The Facebook layer | PASS | `npx playwright test tests/shots.spec.ts` (`npm run shots`) | `✓ events tab` · `✓ event page with Interested, Going, guest list and Find my party` · `✓ messenger-style group chat` · `✓ notification toast arrives live` · `✓ demo user switcher` · `5 passed (2.3s)`; screenshots in `shots/m1-*.png` |
| M2 Queue and party formation | PASS | `npm test -- queue` | one failing fixture per rule: `✓ size` `✓ bucket` `✓ window` `✓ age` `✓ blocks` `✓ women_only` `✓ not_only_woman` `✓ bridge` (no shared friend; and a shared 12,000-member Group) · `Test Files  1 passed (1)` · `Tests  19 passed (19)`. UI: `tests/queue.spec.ts` 1 passed; `shots/m2-queue-*.png` |
| M3 Agent conversations | PASS (mock model) | `npm test -- agents` | `✓ Maya's drink rule rejects the rooftop plan` · `✓ the plan.unavailable payload has no reason field` · `✓ no other member's page contains her rule text` · `✓ the verifier blocks a planted leak` (+8 more: code override, signatures lock, round-3 fallback, approved-line table, pair talk sources, unapproved fact, receipts, chat) · `Test Files  1 passed (1)` · `Tests  12 passed (12)`. Real table talk: `npm run talk:real` → `real-table-talk: SKIPPED (no META_API_KEY in the environment or .env.local)`. Stage: `shots/m3-stage.png` |
| M4 Match found | PASS | `npm run test:demo` | `MATCH FOUND lag after plan.locked (ms): maya=6 sound=played dev=5 sound=played ana=5 sound=played kai=5 sound=played zoe=5 sound=played` · `✓ demo path: five phones, one MATCH FOUND (16.2s)` · `1 passed (16.6s)`. Also checks /party card, Event page `Your party · 5 going` with Going pressed, chat pinned plan + 5 openers, and that no other member's /party or Event HTML holds Maya's rule text. `shots/m4-*.png` |
| M5 The door | PASS | `npx playwright test tests/door.spec.ts` (+ `npm test -- door`) | `POST /api/frames -> {"frameId":"frame-0001","viewerId":"maya","partyId":"party-6","subjectId":"dev","method":"stub",...}` · `✓ door: the fixture frame shows Dev's card on Maya's /door (13.9s)` · `1 passed (14.4s)`; unit: `Tests  5 passed` (stub never reads pixels, gallery-only ids, viewer-only event, I'm here, tap-a-face). `shots/m5-door.png` |
| M6 After | PASS | `npx playwright test tests/after.spec.ts` and `npm run eval -- --mock` | Playwright: `✓ runitback: private picks, mutual pairs only, shown pair by pair (14.6s)` · `✓ fair: QR join with a typed profile and a consent box (514ms)` · `2 passed (15.6s)`. Eval: `PASS brief 20/20` · `PASS table 4/4` · `PASS privacy (25 generated parties) 1428/1428` · `PASS judge 25/25` · `PASS verifier 24/24` · `PASS grounding 71/71` · `PASS adversarial 3/3` · `eval: 7/7 suites passed`. Unit `npm test -- after`: 5 passed. `shots/m6-*.png`, `evals/PLAN.md` |

## Final run (all checks together, after M6)

| Check | Command | Last lines |
|---|---|---|
| Typecheck | `npm run typecheck` | clean, no errors |
| Unit tests | `npm test` | `Test Files  6 passed (6)` · `Tests  52 passed (52)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 315/315 checks passed` |
| Evals | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| All Playwright specs | `npm run test:e2e` | `MATCH FOUND lag after plan.locked (ms): maya=5 sound=played dev=4 sound=played ana=4 sound=played kai=4 sound=played zoe=4 sound=played` · `10 passed (50.4s)` |

## Demo video

`shots/demo.webm`: 60 seconds, 1280x720, recorded by `npm run video`
(`tests/demo-video.spec.ts`) from Maya's screen: Events tab (0 s), the event (4 s), one
sentence with the private preview (12 s), party forming (17 s), the table filling in live
(18 s), MATCH FOUND (30 s), the group chat with the pinned plan and openers (35 s), the party
card and her receipt (40 s), the RSVP on the Event page (46 s), Dev's card at the door (50 s),
and a mutual run-it-back pick (57 s).

## Phase 2 (branch `swarit-features`)

Features land behind flags in `lib/flags.ts`; `FEATURES.md` holds each one's proof. Checkpoint
after F5 (10:36 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npx playwright test` (production build, cold) | 18 specs, `18 passed (2.5m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  77 passed (77)` |
| Demo video | `npm run video` | `saved shots/demo.webm (5407687 bytes, about 60 s)`; timeline 0.1s events, 4.3s event, 11.4s sentence and private preview, 16.4s party forming, 18.0s the table live, 30.5s MATCH FOUND, 35.5s group chat, 40.6s party card, 43.1s Maya's secret, 46.7s event RSVP, 50.8s door card, 57.5s run it back |
| CI | `gh run list --branch swarit-features` | `success` since the lockfile fix |

Checkpoint after F10 (11:02 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npx playwright test` (production build, cold) | 25 specs, `25 passed (3.2m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  106 passed (106)` |
| Demo video | `npm run video` | `saved shots/demo.webm (5535680 bytes, about 60 s)`; same timeline as the F5 checkpoint (MATCH FOUND at 30.3s, Maya's secret at 42.9s) |

Checkpoint after F15 (11:31 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npx playwright test` (production build, cold) | 31 specs, `31 passed (3.6m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Contracts | `npm run contract:check` | `contract:check PASS - 331/331 checks passed` |
| Demo video | `npm run video` | `saved shots/demo.webm (5686873 bytes, about 60 s)` |

Found at this checkpoint and fixed: the first full run failed from the fair-host spec onward.
F12's comparison isolated itself by swapping the global store during async work, so a live
request arriving mid-run landed in the eval store and the restore then clobbered newer state.
Isolation is now by async context (`AsyncLocalStorage`): concurrent requests always see the
live store and nothing is restored. A regression test covers it.

Checkpoint after F20 (12:13 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 39 specs, `39 passed (3.7m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` (privacy 1428/1428) |
| Unit | `npm test` | `Tests  148 passed (148)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 331/331 checks passed` |
| Demo video | `npm run video` | `saved shots/demo.webm (7335438 bytes, about 62 s)`; Maya's phone as before (MATCH FOUND at 27.9s, Maya's secret at 40.3s), now ending on the projector: Try to leak it, Dev's agent types Maya's limits, blocked (57.2s) |
| CI | `gh run list --branch swarit-features --limit 3` | `success` for F18, F19, F20 |

Fixes made before F2 at your request: the lockfile (CI `npm ci` now passes), e2e on a production
build (three cold runs in a row green), and every route checked at 390 px (`tests/mobile.spec.ts`).

## Facebook reference (Step 1)

FACEBOOK_LAYER: no REA reference for the logged-in states. REA (`rea-agents` 6.8.0,
`capture-browser-scenario`, its own temporary profile, logged out) ran two page loads: the
events discovery URL returned "Not Found", and one public Event page rendered behind a login
dialog. Layout regions and about 80 design tokens (colours, radii, spacing, type, the
Messenger chat-bubble tokens) were **seen**. Interested, Going, the guest list and every
Messenger state are **inferred**, because they need a login. See `reference/`.

## Real model run

Not run: no `META_API_KEY` in the environment or `.env.local`, so there is no wall-clock time
for a real table talk. `npm run talk:real` is ready: with a key it runs one table talk with
`MOCK_MODEL=0` and prints the wall-clock time and the calls used. All agent calls tonight
ran on the deterministic mock (`MOCK_MODEL=1`). Real model calls used tonight: 0 of 300.

## Stubs and blockers

- Model: mock by default. Blocker: no `META_API_KEY` was available, so no agent turn tonight
  used a real model, and the brief's "real table talk wall-clock" is not recorded.
- Recognition: `matchFrame(frame, gallery)` in `lib/door/recognition.ts` runs a stub that maps a
  fixture key to a party member and never reads pixels. A real module plugs in with
  `setMatcher()`; whatever it returns, only a gallery member id (or null) gets through.
- Door camera identity: `POST /api/frames` trusts the `viewerId` in the frame body (it stands in
  for a paired door device). A real build would authenticate the device.
- Facebook reference: the logged-out page was gated by a login dialog; Interested, Going, the
  guest list and Messenger are built from inferred layouts plus the seen tokens.
- State is in memory only: a server restart or `POST /api/demo/reset` clears it.
- Inert shell pieces: search, Invite, Share, the overflow menu, the Discussion tab and the map
  are visual only.
- Dev-server note: Next 16 allows one `next dev` per project folder, so Playwright reuses a
  running server on port 3000 (or starts one). Once tonight the dev server's hot-reload state
  wedged and every page reloaded in a loop; `rm -rf .next` and a restart fixed it (noted in the
  README).
