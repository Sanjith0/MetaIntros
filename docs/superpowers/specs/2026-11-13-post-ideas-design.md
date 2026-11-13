# Post ideas after the event: album + squad chat recap

## Why
After an event, "Share the outing" offers one AI-drafted post, and only on a tap. Users should be
handed ideas: what to post, drawn from the squad album and from what the squad talked about, so
nobody starts from a blank post.

## Goals
- When "Share the outing" opens after the event, post ideas load on their own.
- A one or two line recap of the squad chat, shown above the ideas.
- Three post ideas, each with its own photos (up to 4) and caption, in different styles:
  about the event, from the chat recap, short and casual. Tap one to open it in the composer.

Non-goals: Glance / In-Person Connect recaps (they live in a separate Convex backend not linked to
Link's users); posting anything automatically; schema changes.

## Approaches
1. **Extend the existing post draft agent (picked).** Same photo metadata, consent rules and
   caption checks; the model returns a recap plus three ideas instead of one draft. One Muse call.
2. A separate recap agent plus the existing draft agent: two calls, and the ideas wouldn't use the recap.
3. Keep one draft and add a recap: doesn't give a choice of ideas.

## Design
- **Input to Muse:** what it gets today (poster's first name, event, shared interests, allowed photo
  metadata) plus the squad chat: the last 40 `kind: "user"` messages, as `{by: first name or "you",
  text}`, each cut to 200 characters. Host and system lines are left out.
- **Output:** `{recap, ideas: [{style, photoIds, caption}]}`, styles `event | chat | casual`.
- **Code checks (same rules as today, applied to the recap and every idea):** only allowed photos,
  at most 4 per idea, no sensitive sentences, no sentence naming a squadmate who isn't the
  poster's friend; recap capped at 200 characters, at most 3 ideas, duplicates dropped. An idea whose
  caption can't be salved is dropped; if none survive, one labelled template idea is returned.
  If the recap can't be salved (or the chat is empty), it is left out.
- **Fallback (Muse down):** no recap, one template idea, labelled "Template (AI unavailable)".
- **Screen:** after the event, "Share the outing" shows the recap and the three ideas (skeletons
  while loading, a retry on error) above "Make my own post" and "Don't post". The old "Let AI
  suggest a post" row goes; tapping an idea opens the composer with it, as the old draft did.
- **API:** `POST /api/squad/[partyId]/share/suggest` returns `{ok, recap, ideas, source}`.

## Left to the builder
Exact prompt wording and card copy.
