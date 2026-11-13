# Design audit

How the app compared with DESIGN.md on 2026-11-12, at origin/main `3db0b89`.

**Method.** `tests/e2e/screens.spec.ts` captured all 33 screens with the `iphone` Playwright project
(iPhone 14, 390px) into the gitignored `.screens/` folder. I looked at every one, plus `/design` and two
desktop views at 1280px. I also counted rule breaks in code with the new ratchet in
`tests/unit/design-tokens.test.ts`; the counts are in `tests/unit/design-baseline.json`.

**What held up.** Most screens read as the Facebook app and follow DESIGN.md:
- one primary button per screen
- the prototype label everywhere
- AI text and sample people labelled
- sheets with grabbers
- the date line as the only capitals
- no sideways scroll at 390px
- a centred 448px column on desktop

The deviations are below.

Only small fixes outside the hot files were made here. Everything else is a row for a follow-up pull
request. Hot files need a `scripts/board claim` first; see AGENTS.md.

## Fixed in this pull request

| # | Where (line before the fix) | Rule broken | Fix |
|---|---|---|---|
| 1 | `components/queueup/StatusCard.tsx:84` (screen 27) | §8 Icons: an icon names its button's action. "Open squad chat" carried the card's calendar icon | The action icon is now `MessageCircle` for chat links; other states keep theirs |
| 2 | `components/chat/ChatThread.tsx:201` (screen 28) | §8 Layout: sticky bars never cover content. The scroll target was inside the list, so the read-only bar covered the newest message (the "chat has ended" notice). It was also a `<div>` inside a `<ul>` | Scroll target moved after the sticky footer |
| 3 | `app/join/page.tsx:90` (screen 12) | §2 tokens: inputs use the `wash` fill. §8 Accessibility: `outline-none` removed the focus ring | `bg-wash`, no border, global focus ring kept |
| 4 | `app/(app)/friends/page.tsx:107` (screen 10) | §4 States: an empty state has one action | Added a grey "Find a squad" link to `/events` |

## Follow-ups

| # | Where | Rule broken | Fix | Notes |
|---|---|---|---|---|
| 5 | `app/demo/page.tsx:105-106` (screen 13) | §1.2, §4: the selected fill mode is an accent fill, so it reads as a second primary beside "Start as Me" | Checked radio: `bg-on text-link` | hot file |
| 6 | `app/demo/page.tsx:79-176` | §2: 20 default text sizes (`text-sm`, `text-xs`, `text-2xl`) | `text-body`, `text-meta`, `text-page` | hot file |
| 7 | `app/demo/page.tsx:82, 85, 87, 105, 116, 132, 134` | §8 Components: raw `<button>`/`<select>` drawn as white cards with `shadow-card` instead of grey buttons | `Button variant="secondary"`; fill modes as a `Chip` group | hot file; /demo is presenter-only, so low priority |
| 8 | `app/demo/page.tsx:124, 126, 139` | §2: `w-[220px]`, `text-[11px]`, `text-[10px]` | `w-56`, `text-tab`; 10px has no token, so use 11px | hot file |
| 9 | `app/demo/page.tsx` | This brief: `/design` should be linked from `/demo` | One ghost `ButtonLink` "Design system" → `/design` | hot file, so left to its owner; `/design` links back to `/demo` |
| 10 | `components/queue/QueueScreen.tsx:352, 354` (screen 21) | §2: `h-[88px] w-[88px]` | `size-22` (88px on the spacing scale) | hot file |
| 11 | `components/queue/QueueScreen.tsx:171, 310, 367` | §2: `text-[11px]` | `text-tab` | hot file |
| 12 | `components/album/Switch.tsx:13`, `components/profile/QueueVisibilityToggle.tsx:35`, `components/queue/QueueSetup.tsx:196` (screens 18, 32) | §8 Components: three hand-rolled toggle switches | Promote `album/Switch` to `components/fb/Switch` (a `design` PR with a gallery entry) and use it in all three | `QueueSetup.tsx` is hot |
| 13 | `app/join/page.tsx:83, 118`, `components/queue/QueueTogether.tsx:147`, `components/posts/PostComposer.tsx:126` | §8 Components: no text field or checkbox in `components/fb`, so pages hand-roll them | Add `TextField` and `Checkbox` to `components/fb` (a `design` PR) | The ratchet counts `app/join` until then |
| 14 | `components/chat/ChatThread.tsx:172, 173, 186, 193`, `components/cards/TalkCardDeck.tsx:154`, `components/queueup/FriendQueues.tsx:51`, `components/fb/Bubble.tsx` (SystemLine) | §2: 12px text has no token, so `text-[12px]` repeats. DESIGN.md asks for 12px sender names | Add `--text-caption: 12px` to `@theme` (a `contract-change` PR; value [inferred] from `reference/MESSENGER_CHAT.md` §2) | |
| 15 | `components/posts/PostComposer.tsx:165` | §2: `text-[11px]` | `text-tab` | |
| 16 | `app/(app)/layout.tsx:16`, `components/queue/QueueSetup.tsx:214`, `components/fb/Toast.tsx` (`bottom-[72px]`) | §2: the tab bar height is repeated as `calc(52px + safe area)` | One `--spacing-tabbar` token or a `pb-tabbar` utility in `app/globals.css` | `QueueSetup.tsx` is hot |
| 17 | `components/chat/ChatThread.tsx:204`, `components/posts/StoryViewer.tsx:79, 115` | §2: safe-area paddings as arbitrary `max(env(...))` | `pt-safe`/`pb-safe` utilities in `app/globals.css` | |
| 18 | `app/(app)/events/[id]/page.tsx:50`, `app/(app)/home/page.tsx:65, 73`, `components/events/EventCard.tsx:25`, `components/feed/PhotoGrid.tsx:15, 20` | §2: `aspect-[2/1]` repeated for covers; `max-h-[520px] aspect-[4/3]` | `--aspect-cover` token; photo grid on the spacing scale | |
| 19 | `app/(app)/chats/page.tsx:16`, `app/(app)/notifications/page.tsx:54` | §2, §4: `min-h-[70dvh]` to centre empty states | A shared `EmptyState` part in `components/fb` | |
| 20 | `components/chat/ChatThread.tsx:170, 184`, `components/cards/TalkCardDeck.tsx:153` | §3 Bubble: max width set outside the part (`max-w-[75%]`, `max-w-[85%]`) | Move the 75% max width into `Bubble` | |
| 21 | `app/(app)/loading.tsx:7`, `components/chat/FindYourParty.tsx:23`, `components/album/SquadAlbum.tsx:155`, `components/feed/Post.tsx:66`, `components/posts/StoryViewer.tsx:77` | §2: one-off sizes `h-[76px]`, `h-[120px]`, `max-h-[50dvh]`, `h-[18px] w-[18px]`, `z-[60]` | Spacing scale (`h-19`, `h-30`, `size-4.5`) and a z-index scale in `@theme` | |
| 22 | `app/(app)/chats/page.tsx:35` (11), `components/chat/FindYourParty.tsx:119` (10), `components/fb/Composer.tsx:32` (22), `app/(app)/video/page.tsx:33` (26) | §8 Icons: sizes outside the set | 12, 12, 20, 24 | |
| 23 | `app/(app)/friends/page.tsx:49` vs `components/friends/SquadConnect.tsx:51` (screens 08, 29) | §1.2: the same action, "Add friend", is `on` in one place and primary in another | Pick one in a `design` PR. Facebook uses blue for both, and repeated row actions count as one primary | debatable |
| 24 | `lib/server/expiry.ts:6` with `components/chat/ChatThread.tsx:206` (screen 28) | §8 Wording: say it once. The archive system line and the read-only bar both say "This squad chat has ended", with the same button below | Shorten the system line to "This squad chat has ended." and keep the bar | Changes server text, which tests assert |
| 25 | `components/events/DateLine.tsx`, `components/chat/FindYourParty.tsx:109`, `components/queue/QueueScreen.tsx:317` | §8 Accessibility: `date` is 3.65:1 and `positive` 3.28:1 on white, below 4.5:1 for small text | Keep the [seen] values for short semibold labels only. A new capture would be needed to change a token | QueueScreen is hot |

## Not checked

- Dark mode: the app has none, and DESIGN.md says not to add `dark:` variants.
- States no screenshot shows: error pages under load, a failed send in chat, every toast.
- Real devices: everything here is Chromium with the iPhone 14 profile.
