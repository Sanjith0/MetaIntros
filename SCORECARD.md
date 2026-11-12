# Scorecard

Branch: `swarit-baseline`. Everything runs locally with `npm install && npm run dev`.

## Milestones

| Milestone | Result | Proving command | Last lines of output |
|---|---|---|---|
| M0 Foundations | PASS | `npm run contract:check && npm test` | `contract:check PASS - 314/314 checks passed` · `Test Files  2 passed (2)` · `Tests  11 passed (11)` |

## Facebook reference (Step 1)

FACEBOOK_LAYER: no REA reference for the logged-in states. REA (`rea-agents` 6.8.0,
`capture-browser-scenario`, its own temporary profile, logged out) ran two page loads: the
events discovery URL returned "Not Found", and one public Event page rendered behind a login
dialog. Layout regions and about 80 design tokens (colours, radii, spacing, type, the
Messenger chat-bubble tokens) were **seen**. Interested, Going, the guest list and every
Messenger state are **inferred**, because they need a login. See `reference/`.

## Real model run

Not run: no `META_API_KEY` in the environment or `.env.local`. All agent calls ran on the
deterministic mock (`MOCK_MODEL=1`). Real model calls used tonight: 0 of 300.

## Stubs and blockers

- Model: mock by default (no key available tonight).
