# Queue Up — go to events with a squad, not alone

**Queue Up** is a feature inside Facebook Events. It has three ways in, which run as separate queues:

| Queue | Where you start it | What you get |
|---|---|---|
| **This event** | "Find a squad to go with" on an event page | A squad for that event |
| **Any event** | Events tab → "Go with a squad" → *For any event this weekend* | A squad, plus an existing event you'll all like |
| **New hangout** | Events tab → "Go with a squad" → *For a new hangout* | A squad, plus a brand-new hangout at a public spot near all of you, at a time you're all free |

The phone UI reads as the Facebook mobile app with Queue Up as a native layer in the Events tab (see `DESIGN.md`, `PRODUCT.md`). It's a hackathon prototype: no Meta logos or fonts, a "Hackathon prototype, not Facebook" label on every screen, `noindex`, seeded data only.

Hangout queuers only ever match other hangout queuers. Inside the existing-events queue, "any event" queuers can join someone who queued from a specific event, and then go to that event. Two different specific events never mix.

Whichever queue you pick, Queue Up then:

1. Builds your taste profile from your (mocked) Facebook data.
2. Queues you with nearby people, like a ranked game queue.
3. Forms a compatible **squad** of 4–6 strangers (the engine supports 2–8; the UI offers 4, 5 or 6). An AI agent picks the event, or plans the hangout.
4. Opens a temporary squad chat with an **AI host**.
5. Gives you **talk cards**: grounded icebreakers for each squadmate.
6. Helps you find each other at the venue.
7. After the event, lets you add each other as friends, but only if both of you say yes.

Built for Meta's *Closer Together AI Hackathon*. The model behind every LLM call is **Muse** (Meta Model API).

![screens](docs/screens/after/21-squad-found.png)

---

## Setup

```bash
pnpm install                 # Node 20+, pnpm 10
cp .env.example .env         # works as-is: offline mode, no key needed
pnpm exec prisma migrate deploy
pnpm db:seed                 # 80 personas, 8 landmarks, 27 events, inbox chats
pnpm dev                     # http://localhost:3000  (you are "Jordan Lee")
```

For the demo itself, run the production build. It's faster, with no compile-on-click:

```bash
pnpm build && pnpm start     # then open http://localhost:3000/demo
```

### Muse (optional)

| env | meaning |
|---|---|
| `MODEL_API_KEY` | Muse / Meta Model API key. Leave it empty to run on cache plus deterministic fallbacks. |
| `MUSE_BASE_URL` | defaults to `https://api.meta.ai/v1` (OpenAI-compatible) |
| `MUSE_MODEL` | defaults to `muse-spark-1.1` |
| `AI_MODE` | `cache` (default: never calls out) or `live` (cache first, then Muse on a miss) |
| `AI_MAX_CALLS` | hard cap on live calls per server process (default 400; one Companion-engine room is about 45) |
| `FALLBACK_*` | optional second OpenAI-compatible provider, e.g. Llama API |

Warm the cache once with a key, so the demo replays real Muse output with no network:

```bash
MODEL_API_KEY=... pnpm ai:warm   # ~45 calls per squad (a room of 8 Companions), written to data/ai-cache/
```

### Live demo with judges' phones

1. **Open the control panel.** Go to `/demo` and pick **Live only** (or **Mixed**: real people first, then simulated fillers).
2. **Give phones a URL.**
   - **HTTPS (needed for real GPS):** run `cloudflared tunnel --url http://localhost:3000` and set `PUBLIC_URL` to the tunnel URL. The QR code on `/demo` then points there.
   - **No internet:** phones on the same Wi-Fi use `http://<laptop-ip>:3000/join`. Browsers block GPS on plain HTTP, so they pick a landmark area instead.
3. **Pick the same size.** Everyone chooses the **same party size**, for example 4 judges + you = size 5, and you'll be matched together.

### One global clock

The app runs on a single clock: real time plus a demo offset that only ever moves forward. Every stored timestamp, expiry, countdown and "x min ago" on every phone reads from it (`lib/clock.ts`). Database `@default(now())` columns are filled from it too.

- **Fast-forward: end event** advances the clock for everyone to just after the squad's event ends, and ends that event's squad chats on the spot.
- **Reset & reseed** never moves the clock back. It rebuilds the world around the clock, in the next weekend that's still ahead, so the scripted demo works again straight away.

---

## Architecture

```mermaid
flowchart LR
  subgraph Phone["Phone / laptop browser (Next.js client)"]
    UI["Events · Queue · Squad chat · Talk cards · Friends"]
    SSE["one shared EventSource"]
  end

  subgraph Server["Single Node process (Next.js App Router)"]
    API["Route handlers /api/*"]
    BUS["In-process pub/sub (SSE bus)"]
    TICK["Matchmaking ticker (2s)"]
    SIM["Simulated-user filler"]
    subgraph Match["lib/match (pure, tested)"]
      PROF["Profile builder + offline embeddings"]
      COMPAT["Pairwise compat + group cohesion"]
      ENGINE["Queue engine: widening search"]
      SAFE["Safety rules (hard, code-enforced)"]
      FIT["Event fit scoring"]
    end
    subgraph Companion["lib/companion: the Companion engine"]
      BRIEF["Briefs: what each Companion knows + may share"]
      ORCH["Orchestrator: circles, then final squads"]
      COMP["Companions: one per person, batched rounds"]
      CHECK["Code checks on every line"]
    end
    subgraph Agents["lib/agents (1 Muse call each)"]
      ESA["Event Selection Agent"]
      HPA["Hangout Planner Agent"]
      HOST["AI Host"]
      CARDS["Talk Cards Agent"]
    end
    AI["lib/ai: runAi(): mock · cache · timeout · fallback · budget"]
    TRACE["AgentTrace writer"]
  end

  DB[("SQLite via Prisma (WAL)")]
  GRAPH[/"data/mock-graph (Graph-API-shaped JSON)"/]
  CACHE[/"data/ai-cache"/]
  MUSE(["Muse API (optional)"])

  UI -->|fetch| API
  SSE <-->|text/event-stream| BUS
  GRAPH --> PROF --> DB
  API --> TICK --> ENGINE
  SIM --> DB
  ENGINE --> COMPAT
  ENGINE --> SAFE
  ENGINE -->|the room: everyone who could match| BRIEF --> ORCH
  ORCH -->|circles| COMP
  COMP -->|proposals, backing, sign-off| ORCH
  COMP --> CHECK
  ORCH -->|squads| SAFE
  SAFE -->|existing-events queue| ESA --> FIT
  SAFE -->|hangout queue| HPA
  ESA --> HOST
  HPA --> HOST
  HOST --> CARDS
  COMP -->|conversations between squadmates| CARDS
  BRIEF & ORCH & COMP & ESA & HPA & HOST & CARDS --> AI
  AI --> CACHE
  AI -.->|cache miss, live mode only| MUSE
  Agents --> TRACE --> DB
  Companion --> TRACE
  API --> DB
  TRACE --> BUS
  API --> BUS
```

**Pipeline when a squad forms:**

1. **The room.** Code gathers everyone in the queue who could be matched with you: same queue and event, same squad size, within the search radius, allowed by the safety rules (up to 30 people).
2. **The Companion engine decides who goes together** (`lib/companion`). Every person has a **Companion** agent that knows only its own person:
   - **Briefs.** Code builds each person's facts from their profile, with a share level per fact (share / only as a need / private). The Profile Analyst adds how the person communicates. Sensitive items never enter a brief. You choose what your Companion may share on your profile page.
   - **Circles.** The **Orchestrator** sorts the room into circles of 8–15.
   - **Vectors shortlist, Companions decide.** Two Companions only talk if their people's similarity score (profile vectors plus overlap) is at least 65%, except that everyone also talks to their closest few, so nobody is stranded.
   - **Everyone in a circle talks, taking turns.** In each pair one Companion starts (starts are spread evenly). After both introduce their person, the first asks a scenario question, the second answers and asks one back, and the first answers. Then each privately scores the other person, having heard the whole exchange. A Companion describes its person in the third person and never imitates them.
   - **Asking before saying no.** When a Companion's answer would turn down something the other side suggested, it asks its real person first: "Your Companion thinks you wouldn't be into karaoke. Would you?" (Not for me / I'd be up for it). The answer picks which line is sent, with no extra Muse call, and "up for it" is remembered. After 45 seconds the Companion's guess is sent. Simulated people are never asked.
   - **Deep dives.** Pairs where a Companion asked for more (or the two scores disagree) get one more exchange: a reaction, an honest concern, and what each person would need.
   - **Proposals and deliberation.** Each Companion proposes a squad for its person, then backs, amends or holds.
   - **Check-in with you.** After the first round, each real person's phone shows who their Companion would pick and why. They can drop people (code never puts them together) and tell their Companion what it got wrong or what they actually want (private to their Companion, remembered next time). If they don't answer within 45 seconds, the Companion goes ahead.
   - **Squads.** The Orchestrator forms squads of exactly the size you picked, only from people a Companion chose.
   - **Group conversation and sign-off.** In one round, each of the squad's Companions speaks to the group and says yes or no. A no is binding and anonymous, and the Orchestrator revises once. Then the ready check gives each real person the final call (I'm in / Not this group). Until everyone is in, nobody sees who else was queueing, and in the live view other people show up by first name, age and their own intro line, with blurred photos.

   A Companion makes one Muse call per round and speaks to everyone in that round, so a room of 8 is about 45 calls (about 37 once each person's brief is cached). Code checks every line: citations must be the speaker's own shared facts, private facts and sensitive topics are blocked, and each prompt holds exactly one person's brief.
3. **Code re-checks safety** on every squad before it is committed.
4. The next step depends on the queue:
   - **Existing-events queue:** the **Event Selection Agent** chooses from events that code has already verified. Its pick is then re-validated.
   - **Hangout queue:** code builds every option: a public spot (`data/seed/spots.json`) within 12 km of *every* member's area, a slot inside everyone's shared free time and the spot's hours, and nothing anyone dislikes. The **Hangout Planner Agent** picks one and names it, in one Muse call. Its pick is re-validated, and its text is length-capped and sensitivity-filtered. The plan is saved as a squad-only event (`Event.kind = "hangout"`), so chat, check-ins, expiry and "Met through Queue Up" work unchanged.
5. **Ready check ("I'm in").** Every real member gets 10 minutes (`acceptWindowMs` setting) to tap **I'm in** or **Not for me**. Until everyone is in, the server shows only first name, last initial and shared interests: no photos, no rationale, no trace.
6. On the last accept, "Your squad is ready" plays, the squad chat is created and the **AI host** welcomes everyone. "How your Companions decided" shows each person their own Companion's conversations with their squadmates, and how its pick compares with ranking people by similarity.
7. The **Companions' conversations** between squadmates feed the **talk cards** and are shown on the cards screen, labeled as AI.
8. Every step is written to `AgentTrace` and streamed to the "How we matched you" panel.

**Code map:**

| path | what |
|---|---|
| `lib/graph` | Graph API–shaped schemas, mock source, interest vocabulary |
| `lib/profile` | taste profile builder, deterministic embeddings |
| `lib/match` | compatibility, cohesion, queue engine (separate queues), safety, event fit, hangout fit, friend safety |
| `lib/companion` | the Companion engine: briefs, message checks, Orchestrator, Companion rounds, the room |
| `lib/agents` | event selection, hangout planner, AI host, talk cards (prompts + validation) |
| `lib/ai` | the single model interface |
| `lib/server` | DB services (queue, pipeline, chats, host, expiry, friending, demo) |
| `app/` | UI and API routes |
| `components/fb` | Facebook-style primitives (TopBar, TabBar, Sheet, ListRow, Bubble…) on the tokens in `app/globals.css` |
| `tests/unit` | Vitest (`pnpm test`; includes a design-token guard) |
| `tests/e2e` | Playwright (iPhone viewport, production build, network disabled; `E2E_PORT` if 3100 is taken) |

---

## How it maps to the rubric

| Criterion | Where it shows |
|---|---|
| **AI integration** | A multi-agent **Companion engine** plus four single-call agents, all behind one Muse adapter. Every person has a **Companion** that talks to the others in its circle, proposes a squad, deliberates and signs off; an **Orchestrator** draws the circles and forms the squads; code checks every line and re-checks every squad. **Event Selection Agent** picks from code-verified events, with runner-ups and reasons. **AI host** writes a welcome plus an icebreaker grounded in a real shared interest, then replies to @mentions. **Talk Cards Agent** writes openers from source-cited facts. The streaming **"How we matched you"** trace makes the agents' reasoning visible. |
| **Product thinking & user impact** | Going alone is the barrier, so the squad is the product. Safety is designed in from the first screen. Party size works like a game mode. Expiring chats keep it low-pressure. Mutual-consent friending turns one night into lasting connections. "Met through Queue Up" closes the loop inside Facebook. Live sign-up plus Live/Mixed modes show it working with real people in the room. |
| **Execution & demo** | `/demo` panel: one-click reset, fill modes, QR join, AI cache toggle, live queue view. The full 10-step script is an automated E2E that runs in about 30s. It also runs with the network disabled. iPhone screenshots of every screen are in `docs/screens/after/` (before the Facebook-shell rework: `docs/screens/before/`). |
| **Originality & cohesion** | A game-style queue (timer, slots filling, widening search, one loud "Your squad is ready" moment) drawn in Facebook's own materials, mapped onto real-world social anxiety. It reads as native Facebook Events, Messenger and Friends. One data model runs from Graph-shaped data through to the friendship edge, with the event recorded on it. |

---

## Safety & privacy by design

All of these are enforced **in code**, with property-based tests. An agent can propose; code decides.

- **Age bands.** Users only match within their own band (13–15, 16–17, 18–24, 25+), so minors and adults are never in the same squad. Search widening never relaxes this. Friend suggestions never cross the minor/adult line. *(The demo uses self-declared age at sign-up. Production would use Facebook's verified age.)*
- **Women-only option.** A woman can choose to be matched only into all-women squads. This is enforced pairwise and at party level.
- **Blocks.** Blocked users are never matched together, never suggested as friends, and can't send squad friend requests, in either direction.
- **Public venues only.** Queueing for a private-address event is refused. The event agent's pick is re-validated against `isPublicVenue`. Hangouts are only ever planned at public spots from a curated list, never someone's home.
- **Squad-only hangouts.** A planned hangout never appears in the feed, can't be RSVP'd or queued into, and its page 404s for anyone outside the squad.
- **Opt-in, party-scoped photos.** Members can add a "find me" photo that only their squad can fetch. Anyone outside the squad gets a 404. Photos are deleted when the chat ends.
- **You control your Companion.** Your profile page lists everything your Companion knows, and for each fact you choose: share, only as a need (it can ask for what you need without saying why), or keep private. Code blocks any line that repeats a private fact.
- **No one is named as the reason.** If a Companion declines a squad, the others only see that the group changed.
- **Grounded talk cards.** Every claim cites the exact field it came from, such as `p05:groups[1]` or `mutualFriends`. Claims whose sources don't resolve are stripped, and cards are re-validated again when read.
- **No sensitive inferences.** Politics, religion, health and sexuality are never used for matching and never shown. Sensitive pages are flagged at the vocabulary level, and a text filter backs that up. Tests run against a deliberately hostile mock model and planted sensitive data.
- **Minimal data to the model.** Prompts contain first names and non-sensitive interest labels only. Each Companion call holds exactly one person's brief plus what the others chose to share.
- **Location.** GPS is used only to pick a nearby landmark area, and the exact fix is never shared. Any GPS fix more than 15 km from every Queue Up area is ignored in favor of a manual pick.
- **Mutual-consent friending.** A friendship exists only when both people tap *Add friend*. One-sided requests stay pending, and nobody is told if you don't add them.
- **Expiring chats.** Squad chats auto-archive 24h after the event and become read-only.
- **Private post-event ratings.** When a squad chat ends, each member gets a pop-up to rate the night (1–5) and, optionally, say per squadmate whether they'd squad up again. Only the rater can read their answers back. Stars tune "For you" and the event pick; "again" lifts that pair's match score; "not again" keeps the pair out of future squads (never between people who queue together). The trace says ratings were used, with no names or counts, and the agent's rationale may not mention them (`lib/match/ratings.ts`, `lib/server/ratings.ts`).
- **Real-person transparency.** AI-host messages, Companion conversations and AI-written openers are labeled as AI.

---

## Testing

```bash
pnpm test        # typecheck + lint + Vitest (unit, integration, property-based)
pnpm test:e2e    # Playwright on a production build, NETWORK_DISABLED=1
pnpm test:all
```

- **Property-based tests (fast-check).** Random queues, including minors, women-only users, blocks, every party size and every fill mode, always satisfy the safety invariants. That includes when a malicious agent picks the group. Event picks are always public, inside everyone's free time, and free of anything a member dislikes.
- **E2E coverage:**
  - every tab
  - feed filtering
  - live sign-up on two phones
  - GPS and manual queueing
  - a 3-person live party
  - realtime chat between two clients
  - squad chat with badges
  - host welcome
  - talk cards
  - check-ins and photo privacy
  - expiry
  - friending
  - the full scripted demo
  - the screenshot sweep

## Synthetic data

There is no real Facebook data. `scripts/gen-personas.ts` deterministically generates 80 Graph-API-shaped personas aged 18–30 around Menlo Park, Palo Alto, Stanford and Redwood City:

- Interest clusters: indie + climbing, board games + anime, run club + coffee, hiking + photography, builders, food, plus bridge personas and two deliberate outliers.
- Friend graphs: dense within clusters, sparse across them.
- Planted sensitive likes, so the privacy filter has real data to strip.
- Seeded blocks.

`MockGraphSource` can be swapped for a real Graph API client.
