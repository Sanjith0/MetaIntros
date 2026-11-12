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
| `AI_MAX_CALLS` | hard cap on live calls per server process (default 150) |
| `FALLBACK_*` | optional second OpenAI-compatible provider, e.g. Llama API |

Warm the cache once with a key, so the demo replays real Muse output with no network:

```bash
MODEL_API_KEY=... pnpm ai:warm   # ~5 calls per squad, written to data/ai-cache/
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
    subgraph Agents["lib/agents (1 Muse call each)"]
      PFA["Party Formation Agent"]
      ESA["Event Selection Agent"]
      HPA["Hangout Planner Agent"]
      HOST["AI Host"]
      CARDS["Talk Cards Agent"]
      COMP["Companion pre-chats"]
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
  ENGINE -->|top candidate groups| PFA
  PFA -->|choice| SAFE
  SAFE -->|existing-events queue| ESA --> FIT
  SAFE -->|hangout queue| HPA
  ESA --> HOST
  HPA --> HOST
  HOST --> COMP --> CARDS
  PFA & ESA & HPA & HOST & CARDS & COMP --> AI
  AI --> CACHE
  AI -.->|cache miss, live mode only| MUSE
  Agents --> TRACE --> DB
  API --> DB
  TRACE --> BUS
  API --> BUS
```

**Pipeline when a squad forms:**

1. The engine proposes candidate groups.
2. The **Party Formation Agent** picks one using its tools: `getProfiles`, `scoreGroup`, `checkSafetyRules`.
3. **Code re-checks safety** on that pick.
4. The next step depends on the queue:
   - **Existing-events queue:** the **Event Selection Agent** chooses from events that code has already verified. Its pick is then re-validated.
   - **Hangout queue:** code builds every option: a public spot (`data/seed/spots.json`) within 12 km of *every* member's area, a slot inside everyone's shared free time and the spot's hours, and nothing anyone dislikes. The **Hangout Planner Agent** picks one and names it, in one Muse call. Its pick is re-validated, and its text is length-capped and sensitivity-filtered. The plan is saved as a squad-only event (`Event.kind = "hangout"`), so chat, check-ins, expiry and "Met through Queue Up" work unchanged.
5. **Ready check ("I'm in").** Every real member gets 10 minutes (`acceptWindowMs` setting) to tap **I'm in** or **Not for me**. Until everyone is in, the server shows only first name, last initial and shared interests: no photos, no rationale, no trace. Simulated members accept on their own. If someone passes or time runs out, nobody is told who. They leave the queue, and everyone who said yes goes back in with their original place in line. A hangout planned for that squad is dropped (`lib/server/readyCheck.ts`).
6. On the last accept, "Your squad is ready" plays, the squad chat is created and the **AI host** welcomes everyone.
7. **Companion pre-chats** run, and their sparks feed the **talk cards**.
8. Every step is written to `AgentTrace` and streamed to the "How we matched you" panel.

**Code map:**

| path | what |
|---|---|
| `lib/graph` | Graph API–shaped schemas, mock source, interest vocabulary |
| `lib/profile` | taste profile builder, deterministic embeddings |
| `lib/match` | compatibility, cohesion, queue engine (separate queues), safety, event fit, hangout fit, friend safety |
| `lib/agents` | the six agents (prompts + validation) |
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
| **AI integration** | Five agents behind one Muse adapter. **Party Formation Agent** reviews engine candidates with tools and writes a rationale. **Event Selection Agent** picks from code-verified events, with runner-ups and reasons. **AI host** writes a welcome plus an icebreaker grounded in a real shared interest, then replies to @mentions. **Talk Cards Agent** writes openers from source-cited facts. **Companion pre-chats** are two-profile simulations that surface sparks. The streaming **"How we matched you"** trace makes the agents' reasoning visible. |
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
- **Grounded talk cards.** Every claim cites the exact field it came from, such as `p05:groups[1]` or `mutualFriends`. Claims whose sources don't resolve are stripped, and cards are re-validated again when read.
- **No sensitive inferences.** Politics, religion, health and sexuality are never used for matching and never shown. Sensitive pages are flagged at the vocabulary level, and a text filter backs that up. Tests run against a deliberately hostile mock model and planted sensitive data.
- **Minimal data to the model.** Prompts contain first names and non-sensitive interest labels only. Companion pre-chats see exactly two profiles.
- **Location.** GPS is used only to pick a nearby landmark area, and the exact fix is never shared. Any GPS fix more than 15 km from every Queue Up area is ignored in favor of a manual pick.
- **Mutual-consent friending.** A friendship exists only when both people tap *Add friend*. One-sided requests stay pending, and nobody is told if you don't add them.
- **Expiring chats.** Squad chats auto-archive 24h after the event and become read-only.
- **Real-person transparency.** AI-host messages, AI pre-chats and AI-written openers are labeled as AI.

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
