# Party Queue: Devpost draft

## Tagline

Type one sentence on an Event. Five AI agents, each knowing only one person, settle a night
out without anyone's private rules leaving their phone.

## Inspiration

Going to an event alone is hard; going with five strangers who happen to fit you is better.
But the things that decide whether a night works for you ("out by eleven", "under twenty
bucks", "nowhere I have to drink") are exactly what you don't want announced to strangers.
We wanted the group to plan around your limits without ever learning them.

## What it does

Party Queue is a set of layers on surfaces people already use: the Event page, the Events
tab, group chat and notifications.

1. On an Event, tap **Find my party** and type one sentence. You see your own brief: the
   private rules your agent will hold to, and the lines it may share, which you approve.
2. Code forms a party of five near the same place (or anywhere that night). Everyone shares a
   mutual friend or a small Group with someone else, and blocks, 18+, women-only and
   never-the-only-woman settings are checked by code.
3. Five agents meet at a shared table, each a separate model call that sees only its own
   person's brief and the public table. Plans that break someone's rule show up only as
   **"unavailable"**, with no reason and no name. Code checks every plan after the model, needs
   five signatures, and falls back to the best valid plan if they don't agree.
4. In pairs, agents find what two people have in common, choosing only from facts each
   person approved. Code writes the sentence.
5. All five phones show **MATCH FOUND** within milliseconds, with sound. The plan becomes an
   RSVP, and a group chat opens with the plan pinned and one suggested opener per person.
6. At the door, a card (or a glasses heads-up view) says who is in front of you and what to
   say. Nothing is inferred from a face.
7. If no plan fits all five, code says so without blaming anyone: everyone is back at the front
   of the queue, the same five never re-form, and anyone whose own rules close every plan
   there is told so privately, with a way to queue for anywhere tonight.
8. Afterwards, everyone privately picks who they'd see again. Only mutual picks are revealed;
   everyone else sees the same "queue again" card.

On the projector, every agent turn carries a context audit: code checks each prompt, before
the call, for anyone else's private words, and one tap shows the exact prompt. **Try to leak
it** lets the room type a leak as any agent and watch the verifier stop it, and **What if…**
re-runs the same five in a sandbox with rules taken away, to show which rules closed which plans.

On your own phone, **Maya's secret** shows your rules next to "What the party knows". That
column is computed by scanning everything the other four can load, and it stays empty.

Around the loop: bring up to three friends, or queue again as the standing party who all
picked each other; change your sentence while you wait, or widen to anywhere tonight, and
keep your place; say it in Spanish; if someone can't make it after the lock, the seat goes to
someone waiting nearby whose rules pass the plan, and nobody is told who left; tell a friend
where you'll be; find each other at the door ("running late", "let's meet by the fountain").
Your agent remembers what you liked, only with your OK, and your private data from the night
is deleted when the chat closes unless you keep it. `/me` lists everything held about you.

For the room: the projector has a **public screen** that shows only what code decided about
plans, and a QR so anyone can follow along on their phone. That view is sanitized on the
server, and a test records its live stream to prove it.

## How we built it

- Next.js (App Router, TypeScript), Tailwind, Zod contracts for every entity and event,
  server-sent events for realtime, all state in memory.
- One OpenAI-compatible model client with Zod-validated JSON, timeouts and deterministic
  fallbacks. Agent verdicts stream in as each agent answers, and the stage shows every
  agent's latency and source.
- A code judge, a verifier for public lines, and pair talk where the model only picks fact ids.
- A projector view with a scrubber that rebuilds the board (plans, signatures, the lock) at
  any moment of the replay.
- Vitest (270 unit tests), Playwright (65+ end-to-end specs on a production build, including
  five phones at once, every route at 390 pixels and axe accessibility checks), and an eval
  harness. Fifty features, each a layer behind one flags file, each with its proof in
  `FEATURES.md`.

## The leak test

`/evals` runs the same 25 generated parties four ways:

| | One prompt (simulated) | One prompt + verifier | Five agents + verifier | Code solver |
|---|---|---|---|---|
| Lines revealing someone's private rule | 118 of 125 | 0 | **0 of 265** | no lines |
| Others' rules in the writer's context | 4 | 4 | **0** | 0 |
| Lines blocked by the verifier | 0 | 125 of 125 | **0** | – |
| Plans that pass everyone's rules | 25 | 25 | **25** | 25 |
| Shared lines and openers | 0 | 0 | **750** | 0 |

The single-prompt column is simulated (no model key was available during the build), and we
gave it perfect planning, so only privacy differs. A real single prompt's leak rate needs a
real model run.

## Challenges

- Making "private" structural, not a prompt instruction: schemas that cannot carry a reason,
  an audience on every event, and a verifier that only accepts approved text.
- Not naming third people: "You both know Priya" names someone who never opted in. Our first
  fix still leaked her id through a bridge id shown as a source; we caught it in a screenshot.
- Timing: all five phones within a second, measured in server time, because phone clocks drift.
- Our own projector was a leak: showing every agent's reasons on a wall is fine for a demo with
  fictional people and wrong at a real fair. The public screen fixes the display; the room's
  phones get a view sanitized on the server.

## Accomplishments

- Zero private words in anything another member can load, across every generated party.
- A whole fair in a sandbox: 100 fictional guests, 20 parties, all locked with every plan
  valid and nothing leaked, in tens of milliseconds on the mock model (`/evals`, At fair scale).
- One sentence to MATCH FOUND on five phones, about 5 ms after the lock.
- Every feature is a layer behind a flag, switchable live from `/demo`.

## What we learned

The model is good at negotiating and bad at keeping secrets, so give it nothing to keep. The
demo has a **Rogue model** switch to prove it: every agent says yes to everything and tries to
tell the table its person's rules, and code still locks a plan that passes all five people's
rules with nothing leaked. Each agent knows one person, and code holds the line.

## What's next

- Run the full suite against the real model (`npm run talk:real`, `npm run eval`).
- A real recognition module behind `matchFrame` (the interface and the rules are in place).
- More languages for the one sentence (Spanish is in).

## Built with

Next.js · React · TypeScript · Tailwind CSS · Zod · Vitest · Playwright · axe-core · qrcode

*Hackathon prototype, not Facebook. All people and data are fictional.*
