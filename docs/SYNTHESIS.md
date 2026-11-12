# SYNTHESIS: one baseline from three branches

**Status:** Phase 1 done; the council revised it (§5). The flow plan is in §4 and the build log in §6.

| Branch | Commit | App | Stack |
|---|---|---|---|
| `main` | `f23ceb9` | Queue Up (squad) | Next 15.5, Prisma + SQLite, SSE bus, `runAi()` with mock, cache and live modes, pnpm |
| `feat/party-queue-mvp` | `98b7a76` | Crews (crew) | Next 15.5, in-memory store, NDJSON stream, npm, src/ |
| `swarit-features` | `fd3df86` | Party Queue (party) | Next 16.4, in-memory store, Zod contracts, about 60 flags, npm |

## 0. Baseline (before any change)

| Check | Result | Notes |
|---|---|---|
| `pnpm install` | green | pnpm 10.33 via `packageManager` |
| `prisma migrate deploy` | green | 3 migrations |
| `pnpm db:seed` (as in the README) | **red** | tsx doesn't read `.env`, so `DATABASE_URL` is missing. Fixed in `4b33a40`, the same way `ai:warm` already does it. |
| `pnpm test` (typecheck + lint + vitest) | green | **168/168** |
| `pnpm test:e2e` (production build, `NETWORK_DISABLED=1`) | green | **26/26**. The README says 24, so that number is stale. |
| Port 3100 | taken on this machine | `E2E_PORT` override added in `4b33a40` |
| Screenshots | `docs/screens/before/` (main), `docs/screens/template/{feat,swarit}/` | Same iPhone 14 viewport. The feat `/crew/[id]/live` capture timed out because it polls every 500 ms. |

Branch notes from reading the code:

- **feat** has no unit tests, only 41 Playwright tests in 4 specs.
- **feat** crew building runs one Spark call, then replays its JSON as paced steps (700 ms each).
- **feat** reveals avatars after accept only in the UI. The APIs return unblurred data regardless.
- **feat** has no after-event state.
- **feat** dissolves the crew for everyone when the seeker leaves.
- **swarit**: only the brief parser calls a model (regex fallback without a key). Table talk and pair talk are deferred.
- **swarit** keeps briefs per user, not per party, so "forget Saturday" can wipe Sunday's brief.
- **swarit** hard-codes Pacific time as `-08:00`.

## 1. Feature matrix

Columns:

- **Has**: M = main, F = feat, S = swarit.
- **Quality**:
  - **T** = tested (unit and/or e2e).
  - **C** = works in cache or no-key mode.
  - **St** = partly stubbed.
- **Demo**: value to a five-minute live demo, from 1 (low) to 5.
- **Port**: cost to bring into main's stack (S under 150 LOC, M, L). "—" means main's version is kept.
- **Verdict**: keep main's, port, combine, defer or drop.

### 1a. The hero path

| # | Feature | What it does | Has | Quality | Demo | Port | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Events tab and feed tabs | For you, Nearby, This weekend; event cards | M F S | M: T C · F: static · S: T | 5 | — | **Keep main's** data. Rebuild the UI in FB materials (Phase 2). |
| 2 | Event page and RSVP | Header, Interested and Going, details | M F S | M: T C · F: buttons dead · S: T, guest list dialog | 5 | S (UI) | **Combine**: main's data and RSVP API, plus swarit's guest counts and face pile layout from `EVENT_PAGE.md`. |
| 3 | Queue entry | How you start queuing | M (3 modes) · F (settings form) · S (one sentence) | M: T C · F: chips ignored · S: T, regex without a key | 5 | — / M-L | **Keep main's** three modes, moved into one sheet (Phase 2). One-sentence entry is §1c #30. |
| 4 | Queue engine, widening search | Buckets by landmark, widens over time, sim and live fill | M F S | M: T (property tests) C · F: auto-starts at size+4 · S: T, exact 5 | 5 | — | **Keep main's** |
| 5 | Queue screen | Timer, slots filling | M F S | all work · M and F are dark gaming screens | 5 | — | **Keep main's** logic. Redraw in FB materials. |
| 6 | Formation agent and "How we matched you" | Agent picks among code-built candidate groups with tools; trace streams over SSE | M · F (swap replay) · S (table talk, deferred) | M: T C · F: one call replayed as steps | 5 | — | **Keep main's.** Drop F's swap replay: it presents one call as live reasoning. |
| 7 | Squad-found moment | The one loud moment | M F S (`/phones`: every phone at once, Web Audio chime, vibrate) | M: T C · S: T | 5 | S (sound and vibrate) · M (`/phones` board) | **Combine**: main's flow redrawn, plus S's chime, buzz and focus. Port the `/phones` board later. |
| 8 | Squad chat and AI host | Temporary chat, host welcome, @host replies | M F S | M: T C · F: scripted replies · S: pinned plan | 5 | S (UI) | **Combine**: main's chat, plus S's pinned plan banner. Messenger bubbles per `MESSENGER_CHAT.md`. |
| 9 | Talk cards | Per-member cards with cited facts and openers | M F (icebreakers) S (deferred, pair talk) | M: T C, re-validated on read | 4 | — | **Keep main's** |
| 10 | Find each other | Check-ins, opt-in party-only photos, meeting pin | M F (live page, MiniMap) S (door: late, meet text, leave quietly) | M: T C · F: no GPS · S: T | 4 | S-M each | **Combine**: main's check-ins and photos, F's `MiniMap` drawing, S's "Running late" and "Leave quietly" (Phase 3). |
| 11 | Chat expiry and archive | Read-only 24h after the event | M S (12h) | M: T | 3 | — | **Keep main's** (24h) |
| 12 | After the event | Mutual-consent friending, "Met through Queue Up" | M · S (run it back, standing parties) | M: T C · S: T | 4 | M-L | **Keep main's.** Defer run it back and standing parties (§2). |

### 1b. Supporting the demo

| # | Feature | What it does | Has | Quality | Demo | Port | Verdict |
|---|---|---|---|---|---|---|---|
| 13 | Live sign-up by QR, GPS mapped to a landmark | Judges join from their phones | M · S (`/fair`) | M: T C | 5 | — | **Keep main's.** Make the data promise true (Phase 2). |
| 14 | `/demo` control panel | Reset, fill modes, QR, cache toggle, live view | M F (fill button) S (Preflight, Run of show) | M: T · S: T | 4 | S (Run of show) · M (Preflight) | **Keep main's.** Port Run of show. Port Preflight later. |
| 15 | AI adapter | One door for every model call | M (`runAi`) F (two-model Muse, smoke, fake server) S (`callModel`, cap) | M: T C | 3 | S | **Keep main's.** Port F's `smoke-muse` as `pnpm ai:smoke`. |
| 16 | AI mode badge | Mock / live / fallback | F | F: T | 2 | S | **Combine**: show it on `/demo` and as a footnote under "How we matched you", not in the top bar. |
| 17 | Notifications list | Bell with an unread count | F (static) S (event log) | S: T | 3 | S | **Combine**: a real tab built from main's data (Phase 2). |
| 18 | Facebook shell mocks | Home, Video, Friends, Notifications, Menu | F S | F: dead buttons | 3 | S | **Port F's template**, rebuilt on `components/fb/` (Phase 2). |
| 19 | UX states | Skip link, focus on the match sheet, failed send and retry | S | S: T (axe) | 2 | S | **Port** (Phase 2) |
| 20 | 390px no-sideways-scroll and axe | Proof the shell holds on phones | S (main checks overflow in one spec) | S: T | 2 | S | **Port** (Phase 4) |

### 1c. Feature candidates (Phase 3)

| # | Feature | What it does | Has | Quality | Demo | Port | Verdict |
|---|---|---|---|---|---|---|---|
| 21 | Queue pulse and event impact | "3 people are waiting near Downtown Palo Alto", "1 squad is going tonight" on the event page | S (F51, F55) · M has the counts | S: T | 4 | S | **Port**: it is the event page's one status line. |
| 22 | Tell a friend | Copy or share "Heads up: I'm going to … check in at 9", with no names | S (F36) | S: T, no state | 3 | S | **Port** (safety, cheap) |
| 23 | Running late, where to meet, leave quietly | Door-time messages that land in the chat | S (F37, F59) | S: T | 3 | S-M | **Port** onto Find each other |
| 24 | Leave the squad | Leave any time; others keep the plan; nobody is named | S (F8) F (dissolves) | S: T | 3 | S-M | **Port** S's rule |
| 25 | Safety page: block, report | What code enforces; block, unblock, report; the reported person is never told | S (F15) | S: T | 3 | M | **Port** |
| 26 | Add to calendar | `.ics` with no names | S (F38, semicolon bug) | S: T | 2 | S | **Drop** (council: not how Facebook does it). #26b auto-RSVP replaces it. |
| 27 | Accept step, blur until everyone's in | Squad is "pending" until each member accepts; photos and names stay blurred | F | F: T (UI only) | 4 | M (touches the core flow) | **Port**, with the reveal enforced server-side too |
| 28 | Pre-event meet-up spot | Pick a nearby public spot and time before the event | F | F: T, model with heuristic fallback | 3 | M | **Port**, reusing main's `spots.json` via `runAi()` |
| 29 | Bridge lines | "You have a friend in common" ties, consent-gated naming | S (F7, rule) | S: T | 3 | S (display) · L (as a formation rule) | **Combine**: display only. Defer the hard rule. |
| 30 | One-sentence entry | Sentence → private rules and preferences, with a preview | S | S: T, regex fallback | 4 | M-L (main's events lack price and drink fields) | **Defer.** Revisit as an optional "Anything we should know?" field. |
| 31 | `/phones` board | Per-phone QR, ack lag board | S (F3) | S: T | 4 | M | **Port** after #7 |
| 32 | Preflight | 8 read-only checks before going on stage | S (F25) | S: T | 3 | M | **Port lite**: DB, AI cache, SSE, seed. Drop the rehearsal, which needs table talk. |
| 33 | Duo and friend-group queue | Bring 1–3 friends; the group is never split | S (F6, F44) | S: T | 3 | L (engine change) | **Defer** |
| 34 | No match, plan B, seat refill, closest fit | Recovery paths when a plan breaks | S (F22, F42, F45, F53, F54) | S: T, need table talk | 3 | L | **Defer** (depends on the deferred agents) |
| 35 | Run it back, standing parties, agent memory | Private picks, standing group re-queues | S (F10, F26, F39) | S: T | 3 | L | **Defer** |
| 36 | Forget my night, auto-forget, your data, consent history | Data rights | S (F24, F43, F40, F60) | S: T, per-user brief bug | 2 | M-L | **Defer**. Main already deletes party photos when the chat ends. |
| 37 | Edit sentence, widen search, voice, Spanish | Sentence extras | S (F34, F49, F16, F50) | S: T | 1 | S each | **Defer** (needs #30). Main widens automatically. |
| 38 | Why this plan, why this, agent story | Provenance of plans and agent verdicts | S (F13, F23, F31, F32, F56, F61) | S: T | 2 | M | **Defer**. Main's talk cards already cite sources. |
| 39 | `/how` proof hub, `/fair/host` | Judge-facing pages | S (F18, F29, F11) | S: T | 1 | S | **Drop** for now. The README covers it. |
| 40 | Agent pre-chat (feat), main's companion pre-chats | Two-profile simulated chats | F M | M: T C | 2 | — | **Keep main's running.** Don't extend: agent-to-agent is a separate branch. |
| 41 | Table talk `/stage`, pair talk, `/evals`, scale test | Agent-to-agent negotiation | S | — | — | — | **Deferred, separate branch** |
| 42 | Facial recognition `/door/glasses` (S), `/glasses` (F) | Recognise squadmates at the door | S F | — | — | — | **Deferred, separate branch** |

## 2. Product-rule conflicts

| Rule | main | feat | swarit | Recommendation |
|---|---|---|---|---|
| Naming | Queue Up · squad | Crews · crew | Party Queue · party | **main's, everywhere** (`PRODUCT.md` vocabulary table) |
| Squad size | user picks 2–8; matched only with the same size | 6–8, default 6 | exactly 5 | **Recommend 4, 5 or 6, default 5** (council). Your call. |
| Age | 13+ queue in separate bands | 18+ (candidates only) | 18+ at join and in formation | **18+ to queue** (sign-up and join check). Band checks stay as a backstop. |
| Entry | three queue modes | settings form | one sentence | **Three modes in one sheet.** Sentence deferred (#30). |
| After the event | mutual-consent friending | nothing | run it back (private picks, mutual reveal), standing parties | **Friending**. It is Facebook-native, and main already keeps refusals invisible. |
| Chat lifetime | 24h after the event | none | 12h after | **24h** |
| Reveal | names and colours shown at match | blurred until all accept | shown | **Recommend an accept step with a server-enforced reveal and no blur effect** (#27, council). Your call. |
| Meeting point | "Front entrance, venue" | a pre-event venue chosen by the model | free-text "where should everyone meet" | **main's default** plus S's free text (#23). F's pre-event spot is #28. |
| Leaving | queue only | the seeker leaving dissolves the crew | others keep the plan, nobody is named | **swarit's rule** (#24) |
| Women-only | at sign-up, women-only squads | women and non-binary only | all-women, or never the only woman | **main's.** Add "never the only woman" later. |
| Location | GPS → landmark, or manual area | the profile's nearest landmark | the event's landmark | **main's** |
| Simulated people | `isSimulated`, labeled only on talk cards | "simulated" tag in chat | fixture people | **Label "Sample person" everywhere they appear** (council: T&S) |
| AI disclosure | "AI host", "simulated" labels | top-bar Mock/Muse badge | "agent" in copy | **Labels in words** (`DESIGN.md` §1.8). Badge moves to `/demo`. |
| Sign-up data | stored until reset | — | — | **Delete live sign-ups after 24h or on reset**, and say so on `/join` |

## 3. Ranking criteria (from the brief, in order)

1. Importance to a five-minute live demo.
2. The README rubric: AI integration, product thinking and user impact, execution and demo, originality and cohesion.
3. Whether one clever prompt could do it.
4. How well it's built.
5. How it will look inside the Facebook shell.
6. Port cost and risk.

## 4. The Events flow (revised after the council)

Rules for every screen:

- The whole feature lives in the Events tab.
- One primary button per screen, and at most two visible secondary actions.
- Row actions in people lists (Confirm, Add friend) are exempt, as they are on Facebook.

The steps:

1. **Events tab.**
   - Facebook's Events tab: title bar, filter chips (For you, Local, This weekend), event cards with a red date line.
   - One slot near the top holds **either** the "Go with a squad" feed unit **or** the status card. They never stack.
   - The feed unit has one primary button, **Find a squad**, which opens a **two-step sheet**:
     - Step 1 lists the three queue modes as rows. *For an event you pick* shows your Interested and Going events first.
     - Step 2 is setup: the event attachment, squad size chips (4, 5 or 6), a "where you'll start from" row, one safety line, and a sticky **Find my squad** button.
2. **Event page.**
   - Cover, red date line, title, venue, host.
   - A grey action row: Interested, Going, Invite and "…". It stays grey so there are never two blues.
   - After 8px of wash, the same "Go with a squad" unit, whose button opens the sheet directly at step 2. That makes it two taps from the event to the queue.
   - The status line is the queue pulse: counts only, and only at 5 or more.
   - Private venues get a grey line and no button.
   - `/queue/start` remains as a full-page version of step 2, for deep links and tests.
3. **Waiting** (`/queue`).
   - Event row, a large tabular timer, "3 of 5 found" with an accent progress bar, slots filling.
   - Grey **Leave queue**.
   - No gamer copy ("Players found" and swords are gone).
4. **Squad found** (the loud moment). It fires on the last accept once #27 lands.
   - A white page: a blue check scales in with one ring, "Your squad is ready", and members in one row of 48px avatars with first names. Sample people are labeled.
   - The event attachment, then primary **Open squad chat**.
   - "How we matched you" is one row that opens a sheet modelled on "Why am I seeing this?". The sheet has two groups, **Checked by code** and **Written by AI**, and each AI line says where it came from (AI, saved AI response, or template). There is no fake "thinking…" stagger. The live step-by-step trace streams on `/demo` for the projector.
5. **Squad chat** (Messenger materials).
   - Group header with a face pile and "6 members", a pinned plan strip, and grey bubbles.
   - The AI host is a plain grey incoming bubble with its name and an AI label.
   - "Aa" composer, and an "Ask the host" quick-reply chip.
   - No "Demo:" buttons on phone screens; fast-forward lives on `/demo`.
   - The info button goes to the squad info screen.
6. **Squad info** (`/squad/[id]`), modelled on Messenger's chat info, not a tabbed mini-app.
   - Face pile, squad name and event line.
   - Round actions: Chat, Event, I'm here.
   - Rows: Talk cards, Find each other, How we matched you, Members, then (Phase 3) Leave squad in red and Report or block.
7. **After.**
   - The archived chat leads to **Add your squad as friends** (`/squad/[id]/connect`), with a blue Add friend per row.
   - Then "Met through Queue Up · Indie Night" on Friends, in the slot where mutual friends usually sit.

**Status card.** One card moves through these states, with exactly one next action each.

| State | Next action |
|---|---|
| waiting | View queue |
| squad ready | Open squad chat |
| at the venue | I'm here |
| after | Add your squad as friends |

**Shell.**

- Top bar: Home shows our own text logotype; other tabs show the section title. Both carry Search and a Messages button with the chats badge.
- Tab bar: Home, Video, Friends, Events, Notifications, Profile. Events takes Marketplace's slot; the real bar is customizable.
- Chats move behind the Messages button.
- Notifications is a real tab built from main's data, with "New" and "Earlier" groups and a small type badge on each avatar.

## 5. Council (one round, five judges)

The judges were a Facebook product lead for young adults, an AI engineer ("couldn't one prompt do this?"), a designer who knows the Facebook app, a trust-and-safety reviewer, and a 20-year-old who just moved to a new city. Each read §1–§4, `PRODUCT.md` and `DESIGN.md`, plus the screenshots.

### Objections that changed the ranking or the flow

| From | Objection | Change |
|---|---|---|
| All five | People see full names and are dropped into a chat with strangers before anyone has said yes. | **#27 accept step moves to #1 in Phase 3.** It is server-enforced. Before everyone accepts, others see first name, last initial and shared interests, but no photo and no blur effect (the designer: blur looks like a rendering bug). There is a 10-minute window, and declines are invisible. The loud moment fires on the last accept (product lead: avoids two reveals). |
| T&S, 20-year-old, product lead | Block, report and leave aren't anywhere in the UI, and a judge asks about integrity within 30 seconds. | **#25, #24 and #22 move up to #2**, as rows in squad info and the member menu, not a separate page. |
| T&S | Simulated squadmates pass as real people (banter, auto-accepted friend requests). | **New:** a "Sample person" label on every member row, chat sender and check-in (Phase 2). |
| T&S | Queue faces and small counts show who is going alone, where, tonight. | **#21 is counts only, shown at 5 or more.** The queued-faces pile is removed (done). |
| T&S | `/join` offers minor age bands, asks for a full name, and keeps data until reset. | **`/join`**: first name only, 18+, "Delete me now", real deletion after 24h, and a note that age and gender are self-declared (Phase 2). |
| T&S | Free-text meeting places can carry a private address. | **#23 uses preset quick replies only** ("Running late 10 min", and so on). The event entrance stays the only meeting point. **#28 drops to last, code only.** |
| AI engineer | "How we matched you" dresses code steps as agent tool calls and plays a fake "thinking…" delay over results that already exist. The model's pick was the code's pick in all 6 cached runs. | **The trace is relabeled** "Checked by code" and "Written by AI", with each AI line's source. The stagger is gone (Phase 2). **New Phase 3 item:** validate the formation rationale (sensitivity and grounding, as the host does). |
| AI engineer | #30 (one sentence) is the only candidate where a model does what code can't. | **#30 moves up to #8**, limited to fields main already has (dislikes, social style, end-by), with each rule's source text checked against the sentence. It stays below the safety work. |
| Designer | Four surfaces before you're in the queue. The hub's four tabs make it a mini-app. Two blue buttons on the event page. | **Two-step sheet; squad info as Messenger chat info; the event page uses the same feed unit** (above). |
| Designer | The host bubble is tinted, and "Demo:" buttons appear on phone screens. | Plain grey bubble with an AI label. Fast-forward only on `/demo`. |
| Product lead | Facebook doesn't use `.ics` files. Queuing should set Interested, and a squad should set Going. | **#26 dropped**, replaced by **auto-RSVP** (#26b). |
| Product lead, designer | Mutual friends are Facebook's moat and the strongest trust signal. | **#29 bridge lines: Demo raised to 5, ported right after safety.** Display only; naming a mutual friend needs consent. |
| 20-year-old | Gamer copy ("Players found", swords, "Party found!"), tool names in the trace, "try @host". | All removed in Phase 2 copy. |

### Open decisions (council answers)

| Decision | Product lead | AI engineer | Designer | T&S | 20-year-old | Recommendation |
|---|---|---|---|---|---|---|
| Squad size | 4–6, aim for 5, no picker | 3–5, default 4 | 4 · 6 · 8, default 6 | 4–6, default 5 | 4, or 5 at most | **Chips for 4, 5 and 6, default 5.** Engine unchanged (it supports 2–8). Changing it is a single line, `SIZES` in `QueueSetup.tsx`. |
| Blur until everyone accepts | yes: first name, age, interests visible | yes, server-side, strip names from trace and rationale | accept step yes, blur effect no | yes, server-side, refill after timeout | yes, but show first name, age and why | **Accept step, server-enforced, no blur effect** |
| Age | — | — | — | hard 18+ at `/join` and in the queue API | — | **18+**. Bands stay as the backstop. |

### Questions the council asked that are still open

- Do judges' phones join Jordan's squad? Does the loud moment fire on their phones or on the projector? *(Plan: mixed mode, so judges can land in Jordan's squad. #7 sound and vibration fire on every phone.)*
- What does someone see 30 minutes before the event if no squad has formed? *(Main widens the search, but there's no defined no-match screen. Flagged as a risk; swarit's no-match work depends on the deferred agents.)*
- What metric do we claim (accept rate, check-in rate, friend-add rate)? *(Could be shown on `/demo`. Not built.)*
- Can `@host` be prompted into revealing another member's profile? *(Not tested yet. Phase 3 item 7 covers it.)*

### Revised port order (Phase 3)

| # | Item | Rows | Size |
|---|---|---|---|
| 1 | Accept step, server-enforced reveal, 10-min window, loud moment on the last accept | #27 | M |
| 2 | Safety in the hero path: leave squad quietly, block, report (block removes them from your squad), tell a friend | #24, #25, #22 | M |
| 3 | Bridge lines: mutual friend with a mini face pile, consent-gated naming | #29 | S-M |
| 4 | Auto-RSVP: queuing sets Interested, a squad sets Going | #26b | S |
| 5 | Squad found on every phone with a chime and vibration | #7 | S |
| 6 | Running late and leave quietly as preset quick replies | #23 | S-M |
| 7 | AI honesty hardening: rationale grounding and sensitivity, talk cards per owner, pre-chat self-citation check, @host privacy test | #6, #9 | S-M |
| 8 | One-sentence entry, limited to main's fields | #30 | M-L |
| 9 | Preflight lite, `ai:smoke`, cache-hit rate | #32, #15 | M |
| 10 | `/phones` board | #31 | M |
| 11 | Pre-event meet-up spot, code only | #28 | M |

**Dropped:** #26 `.ics`.

## 6. Build log

*(Filled in as commits land.)*
