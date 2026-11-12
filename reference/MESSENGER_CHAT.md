# Reference: Messenger group chat

Source: the same REA capture as `EVENT_PAGE.md` (one logged-out public Event page). Messenger
itself requires a login, so no Messenger page was loaded. The Event page ships the shared
stylesheet, and that stylesheet carried the Messenger and chat custom properties listed
below. Those tokens are **[seen]**. The layout and states are **[inferred]** from general
knowledge of the product, because the live chat surface is gated. **[unknown]** marks things
we could not observe.

No names, photos, ids, source code, icons, fonts or images were kept.

---

## 1. Layout regions, top to bottom (full-page chat, desktop)

| Region | Notes | Label |
|---|---|---|
| Top bar | Same 56px top bar as the rest of the site. | [inferred] |
| Left sidebar | Chat list. Expanded width 240px, collapsed 44px. Header "Chats" (24px bold), search pill, then rows: 56px avatar, chat name (15px, weight 500, or 600 when unread), last-message snippet and time (13px secondary), an unread blue dot. | [seen widths; rest inferred] |
| Thread header | 56-64px tall, white card. Group avatar (overlapping two faces for a group), chat name (17px, weight 600), a subline in secondary grey ("N members" or "Active now"), right side round icon buttons in accent blue (call, video, info). | [seen: header button colour = accent; rest inferred] |
| Pinned banner | Directly under the header: a light strip with a pin glyph, the pinned message text clamped to one line, and a chevron to open all pins. | [inferred] |
| Message list | Scrolling column on white. Time separators centred in 12px secondary grey ("Today 9:41 PM"). System lines (someone joined, someone pinned) centred, 12px grey. | [inferred] |
| Composer | Pinned to the bottom. Left: round accent-blue icon buttons (add, photo, sticker). Middle: a pill input (comment-background #F0F2F5, 18-20px radius, 36px tall, placeholder "Aa"). Right: emoji button inside the pill, then a send or like button in accent blue. | [inferred; pill colour seen] |
| Right info panel | Optional, toggled by the info button: avatar, name, "Customize chat", "Chat members", "Media". | [inferred] |

Chat cards on smaller viewports: a chat head card, min width 300px, max 480px, 8px radius,
16px spacing, small shadow 0 1px 2px 10% black [seen tokens].

## 2. Message bubbles [seen tokens, inferred arrangement]

- Incoming bubble: background #F0F0F0, text #050505.
- Outgoing bubble: background is the accent blue #0866FF, text white.
- Bubble padding 8px vertical, 12px horizontal. Bubble radius 18px.
- Consecutive bubbles from the same sender stack with 2px gaps; the joined corners shrink to
  about 4px on the sender's side, so a run reads as one group [inferred].
- Incoming groups in a group chat show the sender's first name above the first bubble
  (12px secondary) and a 28px avatar beside the last bubble [inferred].
- Max bubble width about 60-65% of the thread width [inferred].
- Replied-to message preview: a 3% black backdrop and a 12% black quote line [seen tokens].
- Reactions sit as a small white pill overlapping the bubble's bottom corner [inferred].
- Messages body 15px, line height about 1.33 [inferred from global type tokens].

## 3. Interaction states

| State | Behaviour | Label |
|---|---|---|
| Composing, empty | Pill shows placeholder "Aa"; the right button shows a like/thumb glyph. | [inferred] |
| Composing, has text | The right button changes to a send arrow in accent blue. Enter sends, Shift+Enter makes a newline. The pill grows up to about 5 lines, then scrolls (16px scrollbar padding). | [inferred; padding seen] |
| Sending | The new outgoing bubble appears immediately at the bottom; a small hollow circle under it turns into a filled check when delivered. | [inferred] |
| Seen | Tiny 14px avatars of readers appear under the last message they read. | [inferred] |
| Receiving | A new incoming bubble slides in at the bottom; if the viewer has scrolled up, a "New message" pill appears above the composer instead of jumping. | [inferred] |
| Typing | A grey incoming bubble with three pulsing dots, with the typer's 28px avatar. | [inferred] |
| Unread in list | Bold name and snippet, blue dot at right. | [inferred] |
| Hover on a bubble | Reaction, reply and more icons appear beside the bubble. | [inferred] |
| Pinned | A system line "X pinned a message" plus the pinned banner at top. | [inferred] |

## 4. Notifications and toasts [seen tokens]

- Toast: white, text #1C2B33, link #216FDB, 8px radius, 288-328px wide, 16px vertical and
  10px horizontal padding, elevated shadow. Stacked bottom-left on desktop [inferred].
- Unread badge: red #E41E3F circle with white 12-13px bold count, on the top-bar icons.
- New-notification rows get a light blue background #E7F3FF.

## 5. Data each region needs

| Region | Data |
|---|---|
| Chat list row | chat id, name, member avatars, last message text, last message time, unread flag |
| Thread header | chat name, member count, member avatars |
| Pinned banner | pinned message id, text, who pinned it |
| Message | id, chat id, sender id, sender name, text, timestamp, kind (user / system / agent-seeded), delivery state |
| Composer | viewer id, draft text |
| Info panel | member list (name, avatar initial) |

## 6. What we build (our own components)

- `ChatShell` (sidebar + thread), `ChatListRow`, `ThreadHeader`, `PinnedBanner`,
  `MessageGroup`, `Bubble`, `TimeSeparator`, `SystemLine`, `Composer`, `Toast`.
- Our layer: the plan is posted as the pinned message, and each member's opener is posted as
  an agent-seeded message with a small "Suggested opener" tag so it reads as a layer, not as
  something the person typed. Every seeded line carries the fact ids it was built from.
- No real Messenger icons or glyphs. We use simple shapes and text labels of our own.

## 7. Unknowns

- [unknown] Exact thread header height and sidebar row heights when logged in.
- [unknown] Exact animation timing for incoming messages and typing dots.
- [unknown] Group avatar composition rules for groups of five.
