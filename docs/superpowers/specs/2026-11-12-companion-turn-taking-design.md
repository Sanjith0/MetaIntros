# Companion conversations: turn-taking and asking before objecting

## Why
Conversations read like two monologues: both Companions asked at once, then both answered at once,
so neither ever replied to the other. And when a Companion decided "my person wouldn't want to do
that", it said so on its own guess, without checking with the person.

## Goals
- Each pair's conversation alternates: 1 asks → 2 answers and asks back → 1 answers.
- Before a Companion turns down something the other side brought up, its real person is asked.

Non-goals: more rounds of back-and-forth; asking simulated (seeded) people anything.

## Approaches
1. **Turn-taking inside the existing batched rounds (picked).** Each Companion still makes one Muse
   call per round covering all its partners; the rounds are re-cut so lines answer each other.
   About one extra call per Companion (~8 per room of 8).
2. Fully sequential per-pair turns: most natural, but a call per line (several times the cost). Rejected.
3. Only re-order the existing lines: no cost, but the lines still don't respond to each other. Rejected.

## Design
- **Who goes first.** For each talking pair, code picks a starter so starts are spread evenly: the
  person who has started fewer conversations goes first; ties break by a hash of the pair.
- **Rounds.**
  1. `ask`: each Companion asks one question to every partner it starts with.
  2. `reply`: each Companion answers every question it was asked and asks one back (two lines).
  3. `answer`: each Companion answers the questions asked back, then writes its private notes on
     every partner (having seen the whole exchange) and its deeper-conversation picks.
- **Thread:** intro, intro, ask (1), answer (2), ask (2), answer (1). Deep round lines: starter first.
- **Objections.** In `reply` and `answer`, when an answer would turn down something the other side
  suggested, the model adds `objection: {activity, ifUp}`; `say` stays its own guess ("not their thing")
  and `ifUp` is the line if the person would be up for it. Both pass the same safety checks.
- **Asking the person.** For a real person with objections in a round, one check-in card lists them:
  "<Person B>'s Companion asked: '…'. Your Companion thinks you wouldn't be into <activity>. Would you?"
  with "Not for me" / "I'd be up for it". The answer picks the line; no extra Muse call. "Up for it"
  is remembered in the brief (`told`) and drops concerns mentioning the activity from that round's
  notes. No answer within the check-in time (45 s) → the Companion's guess is sent. Simulated people
  are never asked. The lines are held until the answer is in.
- The unused sign-off check-in kind in the server and card is replaced by `objection`.

## Left to the builder
Exact prompt wording; card copy beyond the lines above.
