# MetaIntros: Crews for Facebook Events

Queue up for an event like you queue up for a game. Muse forms a crew of 6–8 people near you who'll actually get along, picks where to meet before the show, opens a group chat, and gives you an icebreaker card for every crewmate.

Product spec: [docs/PRD.md](docs/PRD.md).

## Run it

```bash
npm install
cp .env.example .env.local   # add your Meta Model API key (optional)
npm run dev                  # http://localhost:3000 (open in a phone-sized window)
```

Without a key everything works on a deterministic fallback, and the header shows a **Mock AI** badge. With a key the badge reads **Muse live**.

Smoke-test your key and model IDs: `node --env-file=.env.local scripts/smoke-muse.mjs`. To exercise the live-model code path with no key, run `node scripts/fake-muse.mjs` and start the app with `META_API_BASE_URL=http://localhost:4010 META_API_KEY=x`.

## Demo path

`/events` → **Pale Hour** → **Join a crew** → **Find my crew** → press **▶ Demo: fill queue** → watch Muse build the crew → **Meet your crew** → **I'm in** → Crew chat / Icebreakers / I'm here. `/glasses` is the P3 concept.

Reset the demo state: `curl -X POST localhost:3000/api/reset`.

## Test (defines done)

```bash
npm run test:e2e   # builds, starts on :3100, runs e2e/demo-path.spec.ts on an iPhone viewport
```

## Code map

| Path | What |
|---|---|
| `src/lib/types.ts` | Shared contracts |
| `src/data/seed.ts` | Seeded people, events, venues, landmarks (all fictional) |
| `src/lib/agent.ts` | Crew-formation agent: code filters → Muse Spark judgment → code validation → fallback |
| `src/lib/icebreakers.ts` | Grounded icebreakers (every hook must cite shared evidence), chat kickoff |
| `src/lib/signals.ts` | Deterministic compatibility signals |
| `src/lib/muse.ts` | Meta Model API wrapper (OpenAI-compatible, timeout, JSON extraction) |
| `src/lib/store.ts` | In-memory state on `globalThis` |
| `src/app/api/*` | Route handlers (`/api/crew/form` streams agent steps as NDJSON) |
| `src/app/*` | Screens |
