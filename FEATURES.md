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

## Backlog

| # | Feature | Flag | Status | Proof |
|---|---|---|---|---|
| 1 | Stage view: live replay with a scrubber, private and shared columns, code rejections in red, signatures landing | `STAGE_SCRUBBER` | todo | |
| 2 | Maya's secret: her private rule on her phone only, her receipt, and a "what the party knows" column that stays empty | | todo | |
| 3 | Real phones: join by QR on the local network, MATCH FOUND on all five within a second, with sound and vibration | | todo | |
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

(rows added as features land)
