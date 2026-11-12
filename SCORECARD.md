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

- Model: mock by default (no key available tonight).
- Recognition: `matchFrame(frame, gallery)` in `lib/door/recognition.ts` runs a stub that maps a
  fixture key to a party member and never reads pixels. A real module plugs in with
  `setMatcher()`; whatever it returns, only a gallery member id (or null) gets through.
- Door camera identity: `POST /api/frames` trusts the `viewerId` in the frame body (it stands in
  for a paired door device). A real build would authenticate the device.
