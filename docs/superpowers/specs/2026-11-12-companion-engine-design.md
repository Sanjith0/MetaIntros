# Companion Engine: design

Date: 2026-11-12. Status: approved for planning. Extends `2026-11-12-metaintros-design.md`.

## Why

Matching today is thin: a one-line profile summary, one Muse call that writes both sides of
a 4-turn chat, and a Matchmaker that reads only a score. It also assumes a small lobby.
A real event has 30 or more people.

Crews, parties and Party Queue parties are treated as **the same thing** here: a "party" of
3-8 people who should meet. One engine forms them.

## Goals

1. **Scales to a room.** 30 people are narrowed in two steps: a circle, then a party.
2. **Richer.** Companions know their person in depth and have a real conversation.
3. **Faithful.** A Companion describes its person. It never imitates their voice.
4. **Thorough.** Every pair in a circle talks. No party forms with a broken hard rule or a
   member whose own Companion objected.
5. **Affordable.** About 230 Muse calls for a room of 30 (about 8 per person).

## Non-goals

- Pre-event queueing, city-wide venue negotiation, RSVP, door cards, run-it-back.
- Restricting agents to fixed phrases. Companions speak freely, but every claim cites a fact.
- Face recognition and glasses.

## Anti-goals

- A party that looks agent-made but was really decided by a code score.
- A Companion revealing something its person marked private, or anyone being named as the
  reason a group failed.

## Approaches considered

| | How | Verdict |
|---|---|---|
| A. One call per turn, every pair | Each turn of each pair's chat is its own Muse call | About 1,550 calls for 30 people. Rejected on cost |
| B. Code clusters, agents refine | Code groups people by overlap; Companions talk inside | The first cut is a keyword score, so non-obvious matches are lost |
| **C. Orchestrator draws circles; Companions talk in batched rounds and choose** | One Muse agent sorts the room into circles. Each Companion makes one call per round and addresses everyone it is talking to. Companions propose and deliberate the parties; the Orchestrator forms them | **Chosen.** Same visible conversations as A at about a seventh of the calls |

## The agents

| Agent | How many | Job |
|---|---|---|
| Profile Analyst | 1 call per person | Writes the Companion brief |
| Companion | 1 per person | Talks to every Companion in its circle, goes deeper with a few, proposes a party, deliberates, speaks in the group conversation, signs off |
| Orchestrator | 1 per room | Draws circles; forms the final parties from the Companions' proposals. Replaces the Matchmaker |
| Planner | 1 call per party | Meetup spot and activity |

## The flow

```
30 people in a room
   │  Profile Analyst → 30 briefs (each person approves theirs)
   ▼
Orchestrator draws circles            8-15 people each
   ▼
Round 1, every pair in the circle     intro (code) → scenario question → answer + private verdict
   ▼
Deep dive, picked pairs only          follow-up → close + updated verdict + party proposal
   ▼
Deliberation table, one round         back / amend / hold
   ▼
Orchestrator forms parties            3-8, only people a member's Companion wanted
   ▼
Group conversation, two rounds        speak to the group → respond + yes / yes_if / no
   ▼
Parties lock → Planner; icebreaker cards built by code
```

### Batched rounds

A Companion makes **one Muse call per round** and writes to everyone it is talking to in
that round. Each call holds only that Companion's own brief and public text. On screen each
pair still has its own thread.

### 1. The Companion brief

```
brief = {
  owner_id,
  facts:   [{ id, kind, text, depth, share }],   // share: open | need_only | private
  tonight: { hoping_for, energy, group_size_comfort },
  communication: "third person, e.g. 'asks why before how; warms up slowly'",
  lights_up: [fact ids],
  avoid:     [text],
  hard_rules: [{ id, kind: "block", value: person id }],   // code only
}
```

- Code builds the fact list from the profile. The Profile Analyst may add `depth` and the
  descriptive fields but cannot add facts.
- A `need_only` fact may be voiced as a need, never as its reason.
- The lobby shows "What your Companion will say about you" with a share toggle per fact.

### 2. Orchestrator draws circles

- Input: the open part of every brief. Output: circles of 8-15 with a one-line theme, plus
  anyone unplaced. One circle per person.
- Code checks ids, sizes, no duplicates, no blocked pair in one circle. A room of 15 or
  fewer is one circle with no Orchestrator call.

### 3. Round 1: everyone in the circle

| Step | Calls | What happens |
|---|---|---|
| Introduce | 0 | Code posts each person's open facts as their Companion's introduction |
| Ask | 1 per Companion | Reads every introduction; writes one **scenario question** to each circle-mate ("It's 11pm, the music is loud and the group wants to move on. What does yours do?") |
| Answer and judge | 1 per Companion | Answers each question it received (about 100 words each); gives a private verdict on each person; names up to 4 people to go deeper with |

```
verdict = { score 0-100, would_enjoy: [text], concerns: [text], needs: [text],
            talk_topics: [fact ids], opener, confidence }
```

The pair score is the lower of the two verdicts.

### 4. Deep dive: picked pairs only

- A pair goes deeper if either Companion picked the other, or their scores differ by 25 or
  more. Code caps each Companion at 5 deep partners.
- **Follow-up** (1 call per Companion): reacts to each partner's answer, raises a concern,
  asks a harder question.
- **Close** (1 call per Companion): answers, says what its person would need, updates its
  verdicts, and makes its **proposal**: a party of 3-8 that includes its own person.

A deep pair ends with 10 messages; every other pair has 6.

### 5. Deliberation table

- Proposals are posted to the circle's table as member lists and public lines. Private
  reasons stay private.
- One round, 1 call per Companion: `back` a proposal that includes its person, `amend` one
  (add or drop members), or `hold` for its own.
- The table never shows who declined whom.

### 6. Orchestrator forms the parties

- Reads proposals, responses and all verdicts; resolves overlaps; returns parties of 3-8,
  a reason each, and who is held back and why.
- Code enforces: size, real ids, no reuse, hard rules, and **a person may be in a party only
  if another member's Companion proposed, amended in or backed a group containing them**.

### 7. Group conversation and sign-off

- Round 1 (1 call per member): each Companion speaks to the whole group about how the group
  would work for its person.
- Round 2 (1 call per member): responds to the others and answers `yes`, `yes_if` (a need)
  or `no`.
- Code re-checks hard rules regardless of the model. A `no` is binding; the others learn
  only that the group did not work out. The Orchestrator revises that circle once with the
  vetoed combination excluded.
- People not placed stay in the room and are tried again when the room is next run. Briefs
  are cached per person.

### 8. Plan and icebreakers

- The Planner picks a spot and activity, given locations and `yes_if` needs.
- Icebreaker cards are built by code from each pair's verdict: `talk_topics`, shared open
  facts, mutual friends, and the `opener`. No extra Muse call.

## Checks on every Companion message (code)

- every cited id is one of the speaker's own `open` facts;
- the text contains none of the speaker's `private` fact texts;
- the prompt held no other person's private text.

A failing message is replaced with a neutral line and recorded as blocked.

## Trace

Every step emits `{ stage, agent, audience: private | shared, text, source }`.
`source` is `muse`, `recorded` or `fallback`. The lobby reads it.

## Budget (30 people, two circles of 15)

| Stage | Calls |
|---|---|
| Briefs | 30 |
| Orchestrator (circles, parties, revisions) | about 3 |
| Round 1: ask, answer and judge | 60 |
| Deep dive: follow-up, close | 60 |
| Deliberation | 30 |
| Group conversation and sign-off | about 40 |
| Planner | about 4 |

About 230 calls. One call can write to 14 people; how well Muse handles that is untested,
so the batch size per call is a setting (default: the whole circle).

## Proof it works (evals)

1. Obvious match forms a party; obvious clash is never grouped.
2. Hidden dealbreaker: a private fact makes one Companion veto; nobody else learns why.
3. Rogue model: every Companion says yes and states private facts; code blocks the lines.
4. In a 30-person room everyone is in a circle or unplaced, and every pair in a circle has
   a thread.
5. Every party is 3-8 and every member was wanted by another member's Companion.
6. A declined proposal never identifies who declined.

## Left to the builder

- Prompt wording for each agent and round.
- 6 more seeded personas (24 today; the demo room is 30).
- Whether briefs are built on join or at the start of a run.

## Target codebase: Queue Up (`adi-initial`)

The engine is built into the Queue Up app on `adi-initial` (Next.js 15, TypeScript, Prisma
and SQLite, `runAi` Muse adapter with an on-disk cache). It **replaces** that app's Party
Formation Agent and its after-the-fact companion pre-chats. Everything else stays: the three
queues, safety rules, Event Selection Agent, Hangout Planner, AI host, talk cards, trace panel.

| This design | In Queue Up |
|---|---|
| The room | The people waiting in the queue who could be matched with the anchor: same queue and event, same party size, within the search radius, allowed by the safety rules. Capped at 30 |
| Party size 3-8 | **The size each person picked in the queue (2-8).** Companions choose who; the user chooses how many |
| Hard rules | Queue Up's existing `pairAllowed` and `validateParty` (age band, women-only, blocks). No new rule type |
| Facts and citations | The existing source refs (`p05:groups[1]`) and `resolveSource`. Sensitive items never enter a brief |
| `tonight` | Built by code from what the person queued for (the event or a new hangout) and their social style |
| Fallbacks, recording | `runAi` fallbacks and `data/ai-cache`, warmed with `pnpm ai:warm` |
| Threads after a party forms | Copied into the existing `PreChat` rows, so talk cards and the cards screen keep working |
| Trace | The existing `AgentTrace` and "How we matched you" panel, with `orchestrator` and `companion` agents |
| Plan and icebreakers | Unchanged: Event Selection Agent or Hangout Planner, then the Talk Cards Agent |

Two more adaptations:

- The demo's simulated fillers grow from "party size plus one" to a room of 12, so the
  Companions have a circle to choose from.
- Muse is used only for circles that contain a real person. All-simulated circles run on the
  deterministic fallbacks.

## Calls confirmed in conversation

- Everyone in a circle talks; Companions propose and deliberate; the Orchestrator forms.
- Batched rounds, scenario questions, deep dive, group conversation.
- Crews, parties and Party Queue are one concept, size 3-8.

## My calls

- One circle per person, 8-15 people.
- Pair score is the lower of the two verdicts; a 25-point gap triggers a deep dive.
- Up to 4 picks and 5 deep partners per Companion.
- Deliberation is one round; the Orchestrator revises once after a veto.
- Icebreaker cards come from code, using the verdicts.
