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
| Demo video | `npm run video` | `saved shots/demo.webm (7335438 bytes, about 62 s)`; Maya's phone as before (run it back at 52.4s), now ending on the projector: Try to leak it, Dev's agent types Maya's limits, blocked (57.2s), end 61.7s |
| CI | `gh run list --branch swarit-features --limit 3` | `success` for F18, F19, F20 |

Checkpoint after F25 (12:47 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 44 specs, `44 passed (4.1m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` (privacy 1428/1428) |
| Unit | `npm test` | `Tests  174 passed (174)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 333/333 checks passed` (the new `party.nomatch` event) |
| Demo video | `npm run video` | `saved shots/demo.webm (7301232 bytes, about 61 s)`; MATCH FOUND 28.4s, Maya's secret 39.6s, door card 46.3s with "Why this?" opened, run it back 52.0s, Try to leak it blocked 56.7s |

Found and fixed between checkpoints: a party with no common plan left all five queue entries
stuck in "forming" while the stage said they stayed in the queue (F22 fixes it and adds a
test), and the demo-path spec counted nested list items as party members once cards gained
"Why this?" (it now counts direct members).

Checkpoint after F30 (13:21 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 48 specs, `48 passed (4.3m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  190 passed (190)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 333/333 checks passed` |
| Demo video | `npm run video` | `saved shots/demo.webm (7261951 bytes, about 61 s)`; MATCH FOUND 28.4s, Maya's secret 39.6s, door card with "Why this?" 46.2s, run it back 52.0s, Try to leak it blocked 56.7s |
| Scale | `/evals` → At fair scale, 100 | 20 parties, 20 locked, 0 invalid plans, 0 leaks (100 members scanned), 0 real calls |

Found and fixed between F25 and F30: "Reset everything" mid-talk let the old talk keep writing
into the fresh store (F27; a unit test now resets mid-talk); `/queue` treated a locked party as
still forming, so nobody could queue for another night (F26); the projector flickered between
two parties talking at once (F28).

Checkpoint after F35 (13:45 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 53 specs, `53 passed (4.7m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  208 passed (208)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 333/333 checks passed` |
| Demo video | `npm run video` | `saved shots/demo.webm (7263638 bytes, about 61 s)`; ends on the projector with the leak blocked and the caption "Leak test: the verifier blocked it. Nothing reached a phone." |

Found and fixed between F30 and F35: a caption cut "Open Studio: Clay and Tea" at its colon
(F33; titles now come from the plan id), and finished run-of-show beats faded with opacity
failed contrast (F35).

Checkpoint after F40 (14:15 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 58 specs, `58 passed (5.4m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  224 passed (224)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 335/335 checks passed` (adds `door.update`) |
| Demo video | `npm run video` | `saved shots/demo.webm (7531294 bytes, about 61 s)` |
| CI | `gh run list --branch swarit-features --limit 3` | `success` for F39, F40 and the count fix |

Found and fixed between F35 and F40: the 390 px spec said "every route" but had missed eight
pages added after it was written (F40 adds them; all 19 fit), and on a phone the run-of-show
header was crushed beside its clock (F40).

Checkpoint after F45 (14:50 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 63 specs, `63 passed (5.8m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` |
| Unit | `npm test` | `Tests  241 passed (241)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 337/337 checks passed` (adds `party.seat`) |
| Demo video | `npm run video` | `saved shots/demo.webm (7564308 bytes, about 62 s)` |
| CI | `gh run list --branch swarit-features --limit 3` | `success` for F43, F44, F45 |

Found and fixed between F40 and F45: the projector itself showed every member's reasons and
names, which at a real fair would be the leak (F41 adds a public screen mode, and darkens five
buttons whose contrast Tailwind 4 had lowered); the creator of a friend group saw no "waiting
for" line (F44). The network dropped twice during pushes; commits waited locally and went up on
retry.

Checkpoint after F50 (15:30 UTC):

| Check | Command | Last lines |
|---|---|---|
| Every Playwright spec | `npm run test:e2e` (production build, cold) | 68 specs, `68 passed (7.2m)` |
| Eval | `npm run eval -- --mock` | `eval: 7/7 suites passed` (brief 20/20 with Spanish on) |
| Unit | `npm test` | `Tests  252 passed (252)` |
| Contracts | `npm run contract:check` | `contract:check PASS - 337/337 checks passed` |
| Demo video | `npm run video` | `saved shots/demo.webm (7635304 bytes, about 61 s)` |

README: a "For judges: what to check, and where" table at the top (ten claims, each with where to
see it working). Devpost draft: the loop around the core (friends, standing parties, Spanish,
seat refill, tell a friend, find each other, memory with consent, forget by default) and the
room's sanitized view. Found and fixed between F45 and F50: the "follow along" QR as first
planned pointed at a view that was only hidden in the browser, and the room phone showed an
operator button (F46); the lock splash first let the board bleed through (F48).

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
