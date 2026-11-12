# Features (phase 2)

Branch `swarit-features`. Each feature is a layer behind a flag in `lib/flags.ts` (default on;
turn off with `PQ_FLAG_<NAME>=0`). A feature lands only when typecheck, every unit test and
the demo-path test are green; each row below holds its proof.

## Gate (09:52 UTC)

Branched from `swarit-baseline` at `79e00d1`. Before any feature: typecheck clean, `npm test`
52 passed, all 11 Playwright specs passed, `npm run eval -- --mock` 7/7. Looked at all 20
screenshots in `shots/` and fixed: a fair guest's avatar read "R(" (initials now skip
parentheses and non-letters), and the five Dolores Park covers shared near-identical orange
hues (spread across the wheel, layout picked from a title hash).

## Fixes requested at 10:03 UTC (done before F2)

| Fix | What changed | Proof |
|---|---|---|
| CI install | `npm ci` failed on Linux: the macOS-written lockfile referenced `@emnapi/core` and `@emnapi/runtime` without entries. Deleted `node_modules` and `package-lock.json`, ran `npm install`; direct dependency versions unchanged. | `gh run list --branch swarit-features --limit 3` → `completed success Fix CI: regenerate package-lock.json from a clean install ci swarit-features push 43197040278 25s`, after two `failure` runs at install |
| Cold e2e | The first spec failed on a cold `next dev`. Playwright now runs `next build` and `next start` on port 3210 and stops it after each run. Also removed the build's whole-project tracing warning. | `npm run test:e2e` from a cold start, three runs in a row: `13 passed (54.4s)`, `13 passed (52.1s)`, `13 passed (51.1s)`, all exit 0, server stopped between runs |
| Phones (390 px) | `tests/mobile.spec.ts` loads every route at 390×844 and fails if any page scrolls sideways; a second test runs Maya's join to MATCH FOUND on a phone. Fixed: chat header tag clipped to "PA", chat composer pushed below the fold, RSVP banner wrapping, a cut-off fair placeholder, and the stage squeezing two fixed columns (now a scrolling page on phones). | `✓ every route fits a 390-pixel phone` · `✓ phone: Maya joins from a 390-pixel screen and sees MATCH FOUND`; `shots/mobile-*.png` (14 screens) |

## Backlog

| # | Feature | Flag | Status | Proof |
|---|---|---|---|---|
| 1 | Stage view: live replay with a scrubber, private and shared columns, code rejections in red, signatures landing | `STAGE_SCRUBBER` | done (F1) | see Done |
| 2 | Maya's secret: her private rule on her phone only, her receipt, and a "what the party knows" column that stays empty | `SECRET_PANEL` | done (F2) | see Done |
| 3 | Real phones: join by QR on the local network, MATCH FOUND on all five within a second, with sound and vibration | `REAL_PHONES` | done (F3) | see Done |
| 4 | Real-model readiness: streamed verdicts, per-agent latency, a timeout with a fallback labelled on screen, a cached replay labelled as recorded | | todo | |
| 5 | Demo control panel at /demo: reset, pre-queue four members, trigger the lock, switch frame source | | todo | |
| 6 | Duo queue, plus women-only and not-the-only-woman settings in the queue sheet | | todo | |
| 7 | Bridge lines that say a tie exists without naming a third person who never opted in | | todo | |
| 8 | Chat: pinned plan, openers, "I'm here" pings, leaving without attribution before lock, expiry after the event | | todo | |
| 9 | Door and glasses view on the same Spotted contract, with a recorded-clip frame source labelled as recorded | | todo | |
| 10 | Run it back: pairwise mutual reveal, the same "queue again" card for everyone without a match, a standing party | | todo | |
| 11 | Fair mode: a host dashboard with live counts of queued, parties formed and met | | todo | |
| 12 | Evals page at /evals: the leak test with one prompt, one prompt plus the verifier, five agents plus the verifier, and a solver baseline | | todo | |
| 13 | A "why this plan" card built from code checks only | | todo | |
| 14 | Queue for a whole night across several events | | todo | |
| 15 | Safety page: 18+, public venues, blocks, leave and report | | todo | |
| 16 | Voice sentence with a typed fallback, off by default | | todo | |
| 17 | Loading, empty and error states, mobile and accessibility polish | | todo | |
| 18 | README, an architecture diagram and a Devpost draft | | todo | |

## Done

| F | Feature | Flag | Proof |
|---|---|---|---|
| F1 | Stage view with a scrubber: play/pause at the recorded pace (1×/2×/4×), drag to any point and the board (plans, signatures, lock) rebuilds from the trace; Live button follows new traces; rejections and verifier blocks in red, holds amber, signatures land with a check; member toasts never show on the projector | `STAGE_SCRUBBER` | `npm test -- stage`: `Tests 7 passed` (board at end: 3 out, Night Market locked, 5 signatures; rewind to round 2: Kai holding, nothing locked; 4 rejecting agents tagged red). `npx playwright test tests/stage.spec.ts`: `✓ stage: live replay with a scrubber, rejections in red, signatures landing (15.3s)`. Gate: typecheck exit 0, `Tests 60 passed (60)`, demo path `1 passed (17.0s)` with lag 4 ms. `shots/f1-stage-live.png`, `shots/f1-stage-scrub.png` |
| F2 | Maya's secret: on her own /party, "Only on your phone" (her rules as labels plus her exact words, and what her agent turned down and why) beside "What the party knows". That column is computed: code scans everything each other member can load (party view, every live event they receive, the group chat) for her sentence, rule words and private reasons. It shows "Nothing" with the item count, plus the anonymous "· unavailable" marks they saw instead; a planted leak turns it red. | `SECRET_PANEL` | `npm test -- secret`: `Tests 5 passed` (3 rules in her words; empty after scanning 4 phones; planted chat leak caught for all 4; Dev sees only his own rule). `npx playwright test tests/secret.spec.ts`: `✓ Maya's secret: her rules on her phone, the party knows nothing (6.1s)`. Gate: typecheck exit 0, `Tests 65 passed (65)`, demo path `1 passed (10.8s)`, lag 8 ms. `shots/f2-secret.png` (390 px) |
| F3 | Real phones: `/phones` shows a QR code per person pointing at this laptop's Wi-Fi address (`npm run dev:lan`), which opens `/join/<id>` (the user switcher reached from a camera), live dots per phone, and buttons to queue the other four or run the whole party. Phones unlock audio on the first tap (iOS needs a gesture) and buzz where supported. Each phone measures MATCH FOUND in server time (the stream's hello carries the server clock, since phone clocks drift) and reports back, so the board shows the real lag per phone. Operator screens connect as observers and never count as a phone. | `REAL_PHONES` | `npm test -- phones`: `Tests 4 passed` (presence, Wi-Fi address choice, acks in server time, members only, after the lock). `npx playwright test tests/phones.spec.ts`: five 390 px phones open their QR links, `5 of 5 phones live`, Maya types on her phone, `slowest phone showed MATCH FOUND 4 ms after the lock`, `✓ real phones: QR join, all five live, MATCH FOUND within a second (7.8s)`. Gate: typecheck exit 0, `Tests 69 passed (69)`, demo path `1 passed (10.9s)`, full e2e `15 passed (1.1m)`. `shots/f3-phones.png`, `shots/f3-phone-dev.png` |
