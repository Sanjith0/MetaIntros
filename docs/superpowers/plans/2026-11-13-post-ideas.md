# Post ideas after the event: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Share the outing" loads a squad-chat recap and three post ideas (album photos + caption) on its own after the event.

**Architecture:** Extend the Post Draft Agent (`lib/agents/postDraft.ts`): one Muse call (task `post_ideas`) returns `{recap, ideas[]}`; code sanitizes each idea with the existing `sanitizeDraft` rules and the recap with the same sentence filter. `suggestPost` (`lib/server/posts.ts`) adds the squad chat's user messages to the input. `ShareOuting.tsx` fetches ideas on open and shows them as cards.

**Tech Stack:** Next.js 15, Prisma/SQLite, zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-post-ideas-design.md`

## Global Constraints
- At most 3 ideas, at most 4 photos per idea, caption ≤ 220 chars, recap ≤ 200 chars.
- Chat input: last 40 messages with `kind: "user"`, each cut to 200 chars, sender as first name or "you". No host/system lines, no last names, no image data.
- No sentence in recap or caption may be sensitive (`isSensitiveText`) or name a squadmate who isn't the poster's friend.
- Fallback: no recap, one template idea, `source: "fallback"`.
- No schema change. Nothing is posted without the user tapping Share.

## Review Focus
1. Empty squad chat → no recap, ideas still come back (test in Task 1).
2. Squadmate writes a sensitive message in chat → never sent to the model, never in the recap (Task 1).
3. Model returns 5 ideas or duplicate captions → capped to 3, duplicates dropped (Task 1).
4. Every idea's caption is unsalvageable → one labelled template idea (Task 1).
5. Screen opened before the event ends → no suggest call, "Sharing opens once the event is over" (Task 2).

---

### Task 1: Agent + server: recap and three ideas

**Files:**
- Modify: `lib/agents/postDraft.ts`, `lib/server/posts.ts` (`suggestPost`), `app/api/squad/[partyId]/share/suggest/route.ts` (comment only)
- Test: `tests/unit/squad-album.test.ts` ("post draft agent" block)

**Interfaces:**
- Produces in `postDraft.ts`:
  - `MAX_IDEAS = 3`, `MAX_RECAP = 200`, `MAX_CHAT_LINES = 40`
  - `type IdeaStyle = "event" | "chat" | "casual"`
  - `interface ChatLine { by: string; text: string }`; `PostDraftInput.chat?: ChatLine[]`
  - `interface PostIdea extends PostDraft { style: IdeaStyle }`
  - `sanitizeIdeas(raw: { recap?: string; ideas: (PostDraft & { style?: string })[] }, i: PostDraftInput): { recap: string | null; ideas: PostIdea[]; stripped: number; fromTemplate: boolean }`
  - `draftPostIdeas(i: PostDraftInput): Promise<{ recap: string | null; ideas: PostIdea[]; source: AiSource; stripped: number }>` (task `post_ideas`, maxTokens 900)
- Produces in `posts.ts`: `suggestPost` → `{ ok: true, recap: string | null, ideas: PostIdea[], source: AiSource, stripped: number }` (errors unchanged).

- [ ] **Step 1: Rewrite the three model-backed tests in "post draft agent" for the new shape, and add new ones**
  - hostile output: mock `post_ideas` returning `{recap: "We talked about the election. Zoe found the best tacos. Everyone wants a rematch at the arcade.", ideas: [{style:"event", photoIds:[locked,"made-up-id",zoes,freyas,mine,zoes], caption:"Great night with Zoe and Freya. We talked about the election the whole time. The opening band was loud in the best way."}, ...]}` → `ideas[0].photoIds` `[zoes, freyas, mine]`, caption `"The opening band was loud in the best way."`, `recap` `"Everyone wants a rematch at the arcade."`, source `"mock"`; payload has `chat` and no last names/base64.
  - chat input: post `kind:"user"` messages from p02 ("Tacos after?") and p05 ("My therapist says..." — sensitive) plus a `kind:"host"` line → payload `chat` equals `[{by:"Freya", text:"Tacos after?"}]`.
  - caps: 5 ideas with one duplicate caption → 3 ideas, 4 photos each max.
  - empty chat → `recap: null` even if the model returns one; ideas still returned.
  - fallback: every caption unsalvageable → `ideas` length 1, template caption `"Indie Night with my Link squad."`, `source:"fallback"`, `recap:null`; mockProvider reset (model fails) → same.
- [ ] **Step 2:** `pnpm exec vitest run tests/unit/squad-album.test.ts` → the new tests FAIL.
- [ ] **Step 3: Implement** `sanitizeIdeas`/`draftPostIdeas` in `postDraft.ts` (reuse `sanitizeDraft` per idea; drop ideas with `captionFromTemplate`; dedupe captions case-insensitively; recap via the same sentence filter + `truncate`, null when `chat` is empty or nothing survives; unknown style → `"casual"`). Keep `draftPost` deleted only if nothing else imports it. In `suggestPost`, load the party chat's last 40 `kind:"user"` messages (oldest first), drop `isSensitiveText` bodies, map sender to first name or `"you"`, cut to 200 chars.
- [ ] **Step 4:** run the file again → PASS; `pnpm exec tsc --noEmit` clean.
- [ ] **Step 5: Commit** `Post ideas: a squad chat recap and three ideas from the album`.

### Task 2: Share the outing screen + e2e

**Files:**
- Modify: `components/posts/ShareOuting.tsx`
- Test: `tests/e2e/squad-album.spec.ts`

**Interfaces:** consumes `POST /api/squad/[partyId]/share/suggest` → `{ok, recap, ideas, source}` from Task 1.

- [ ] **Step 1: Update e2e:** replace the `share-ai` click with: `share-ideas` visible; `share-idea` count ≥ 1; `share-recap` absent (offline, template); click first `share-idea` → `post-composer` visible, `ai-source` `data-source="fallback"`; rest of the flow unchanged.
- [ ] **Step 2: Implement** in `ShareOuting.tsx`: when `state.open` and step is `choose`, fetch ideas once (ref-guarded). Section `share-ideas` titled "Post ideas from your night": skeletons while loading; `share-recap` paragraph "What your squad talked about" when `recap`; one card per idea (`share-idea`, first photo thumbnail + photo count + caption, label by style: "About the event" / "From your squad chat" / "Short and casual"); error text + "Try again" button (`share-ideas-retry`). Tapping a card → `{ s: "draft", photoIds, caption, source }`. Remove the "Let AI suggest a post" row and the `thinking` step. Keep "Make my own post" and "Don't post".
- [ ] **Step 3: Verify:** `pnpm test` (typecheck + lint + unit) passes except the known date-dependent "clock fast-forwarded past every event"; run `squad-album.spec.ts` e2e from a temp worktree → PASS.
- [ ] **Step 4: Commit** `Share the outing: post ideas load on their own`.
