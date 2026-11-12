# PRD: Crews for Facebook Events

> Working name: **Crews**. Status: MVP build (overnight, Wed Nov 11 → Thu Nov 12, 2026). Branch: `feat/party-queue-mvp`.

## 1. One-liner
Queue up for an event like you queue up for a game. Muse forms a crew of 6–8 people near you who will actually get along, picks where to meet before the event, opens a group chat, and gives each person a personal icebreaker card for every crewmate.

## 2. Problem
- Young adults skip events because walking in alone is awkward and, for many (especially women), feels unsafe.
- Facebook Events shows *what* is happening and which friends are going. It does nothing for the much bigger case where none of your friends are going.
- Group-matching is hard: pairwise "you both like jazz" is promptable; picking 6–8 people who work *as a group*, agreeing on a meet spot across everyone's constraints, and grounding introductions in real profile signal is not.

## 3. Why this fits the prompt
| Prompt / judge signal | How Crews answers it |
|---|---|
| Facebook only, young adults | Lives inside Facebook Events + Groups. Its value grows with the size of the social graph, and that's Facebook's advantage. |
| AI does the hard part | Muse runs the crew-formation agent: scores the group as a whole, explains its picks, rejects bad mixes, negotiates the meetup. |
| Not "one clever prompt" | It's a multi-step agent loop with tool calls (queue state, profiles, venues, availability) plus code-side checks (size, safety filters, travel radius). The output is a structured plan, not text. |
| Use Muse as a tool, not a feature | The user never chats with Muse. Muse decides; the UI shows the decisions. |
| Ends in a real-world act | The crew meets at the chosen spot and walks into the event together. |
| Building responsibly | Opt-in only, 18+, mutual reveal of photos, safety filters (women-only / age band), agents never message humans as you. |

## 4. Target user / demo persona
**Maya, 22**, just moved to Austin for her first job. She has 300 Facebook friends from college and none of them live here. She's interested in an indie concert Saturday but won't go alone.

## 5. Core flow (MVP)
1. **Event page.** Maya opens a Facebook Event (replica UI). A new card reads: "Going solo? Join a crew." It shows the number of people queued nearby.
2. **Queue settings.** She confirms her taste profile (pulled from likes, groups, events attended; editable chips), her free time before the event, and her safety filters (women-only crew, ±3-year age band). Then she taps **Find my crew**.
3. **Queue.** A matchmaking screen in the style of a game queue shows a timer, her proximity bucket ("near South Congress"), and people joining it.
4. **Crew formed (the AI moment).** The agent's reasoning is shown step by step as it streams: candidates considered → group chemistry check → swaps made ("swapped Jordan for Priya: two people wanted a quiet pre-show and Jordan wanted to go clubbing") → final crew of 6 with a "why this crew" line → meetup spot picked with reasons (walkable to the venue, quiet enough to talk, fits everyone's free window and budget).
5. **Accept.** Each member sees the crew and accepts. Photos are blurred until everyone accepts (mutual reveal).
6. **Crew chat.** A group chat (Messenger-style) opens with an agent-posted plan: meet at X at 6:30, walk to the venue at 7:30. The agent seeds a first prompt for the group.
7. **Icebreaker cards.** For each crewmate, Maya gets a card: face, name, 2–3 specific shared hooks ("You both went to Cal Hacks", "You both love Phoebe Bridgers' *Punisher*, ask about the live show"), mutual friends, and one "conversation opener". This is the in-person moment.
8. **Live at event (demo peak).** "I'm here" check-in. The crew map shows who's arrived. Tapping a crewmate opens their card.

## 6. MVP scope (tonight)
**In:**
- Next.js app replicating a Facebook Events surface (mobile-first, demoed on a phone).
- Seeded world: ~40 profiles in Austin (likes, groups, events, availability, landmark bucket, photos as generated avatars), 3 events, 8 venues.
- Queue + proximity bucketing by nearest landmark (code).
- Crew-formation agent (Muse Spark via OpenAI-compatible API) with tool-style inputs and strict JSON output; code validates size (6–8), filters, bucket, and falls back to a deterministic heuristic matcher if the model fails or there's no key.
- Venue selection by the agent, validated against the seeded venues list.
- Icebreaker generation per pair (Muse Ember for volume), grounded only in seeded profile fields; code checks that every hook cites a real shared field.
- Crew chat (local state, agent's first message, simulated crewmates replying).
- "Demo mode" button that fills the queue on cue, so the crew forms live on stage within ~10 s.
- One Playwright test that walks the demo path end to end (this test defines done).

**Out (later):** real auth, real Facebook data, push notifications, real-time multi-device sync, payments, actual face recognition, agent pre-chat.

## 7. AI design
| Step | Model | Input | Output | Guardrails |
|---|---|---|---|---|
| Form crew | Muse Spark 1.3 | Seeker profile + candidates in the same bucket (compressed), event, filters | JSON `{members[], swaps[], rationale, groupVibe}` | Code enforces size, filters, bucket, no duplicates. On invalid output: retry once, then heuristic fallback. Fallback runs are labeled in the UI. |
| Pick meetup | Muse Spark 1.3 | Crew availability, budgets, venue list, event location | JSON `{venueId, time, reasons[]}` | Venue must exist in the list; time must fit everyone's free window. |
| Icebreakers | Muse Ember | Pair of profiles + mutual friends | JSON `{hooks[{text, evidence}], opener}` | Every hook's `evidence` must match a field present in both profiles; unsupported hooks are dropped. |
| Chat kickoff | Muse Ember | Crew + plan | Short message | Length cap; it's labeled as coming from "Crew assistant". |

The UI shows each agent step as a visible "thinking" timeline so judges can see the AI doing the hard part.

**Config:** `META_API_KEY`, `META_API_BASE_URL`, `MUSE_SPARK_MODEL`, `MUSE_EMBER_MODEL`. Without a key the app runs on the deterministic fallback, and the UI shows a "mock AI" badge so the demo can't misrepresent itself.

## 8. Responsible-AI posture (for Q&A)
- **Opt-in, per event.** Nobody is discoverable unless they joined that event's queue.
- **18+ for MVP.** Teen use would need parental controls and age-banded pools only; not in scope.
- **Safety filters.** Women-only / non-binary-inclusive crews, age band, and "no one from my blocked list".
- **Mutual reveal.** Photos and last names unlock only after every crew member accepts.
- **Agents never impersonate.** The crew assistant speaks as itself, labeled. No message is ever sent as a user without their tap.
- **Explainable.** Every crew and every hook shows why ("because you both…"), using only data the person already shared on Facebook.
- **Exit anytime.** Leaving a crew is one tap, and the assistant rebalances without blaming anyone.
- **Meetup spots are public venues only.**

## 9. Demo path (5 min)
1. (0:00) Hook: "Who here skipped an event because nobody could come with you?" (TODO: replace with a sourced stat if we find one.) Introduce Maya.
2. (0:30) Event page → "Join a crew" → confirm taste chips and the women-only filter.
3. (1:00) Queue screen, then press Demo mode. The agent timeline streams, a swap is shown, the crew is formed, the meetup spot is picked.
4. (2:15) Accept → photos unblur → crew chat opens with the plan.
5. (3:00) Icebreaker card for Priya. **Physical peak:** a teammate playing Priya walks up on stage, and Maya opens with the card's line.
6. (3:45) P3 teaser: glasses view mock (crewmate's name + hook floating when you look at them, consent-gated).
7. (4:15) Responsible-AI slide + what's real vs seeded.

Recorded fallback is labeled as recorded.

## 10. Success metrics (pitch)
- % of queue joiners who attend (target > 60% vs Event "Going" baseline).
- Crew retention: crews that make a second plan within 30 days.
- New 18–25 DAU from Events.
- Safety: reports per 1k meetups.

## 11. Roadmap
- **P1 (tonight):** MVP above.
- **P2 (Thu):** agent pre-chat (each person's agent runs a short simulated conversation with the others' agents to stress-test chemistry; humans see only a summary), real-time sync across phones for the stage demo, Muse Voice to set queue preferences by talking, polish.
- **P3: live crew profiles on Meta glasses.**
  - **Scope.** Only *your accepted crew* is recognizable. It's never strangers, and never anyone outside the crew.
  - **How.** Each crew member opts in and enrolls a face template on-device at accept time. The templates are shared only within the crew, encrypted, and expire 2 hours after the event. The glasses match against at most 7 enrolled templates (verification, not open-set identification), using SAM 3.1 to segment the face plus on-device embedding.
  - **UX.** When you look at a crewmate: a name, one hook, and an "arrived" dot in the HUD. Voice: "Hey Meta, what should I talk to Priya about?" brings up the icebreaker.
  - **Safeguards.** An LED capture indicator; no recording; a bystander's face is never processed past detection; a one-tap "hide me" switch for any member.
  - **Hackathon P3 demo.** A phone-camera mock of the glasses HUD, recognizing only the teammates who enrolled on stage.

## 12. Decisions made autonomously (overnight log)
- Product name "Crews" (placeholder).
- Stack: Next.js 15 (App Router) + TypeScript + Tailwind, all data in seeded JSON in the repo, in-memory server state. Reason: fastest to a live, good-looking demo; no DB to set up on stage.
- City: Austin (seeded); landmarks used as proximity buckets: South Congress, UT Campus, East 6th, Zilker, Domain.
- Crew size 6 for demo (spec allows 6–8).
- Face recognition is **not** in the MVP; only blurred → revealed avatars to show the consent mechanic.
- Agent "background conversations with people" was reframed as agent-to-agent pre-chat (P2) for responsibility reasons.
- 18+ only.
- Model calls go through one wrapper with timeout + fallback; there's a mock mode when there's no key.
