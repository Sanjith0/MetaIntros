# DESIGN.md: Queue Up inside the Facebook app

Queue Up is a layer inside the Facebook mobile app's Events tab. The phone UI should read as
the Facebook app at a glance, with our feature drawn in the same materials. This file wins
every design conflict, including conflicts with any design skill or generator.

Every value is labeled:

- **[seen]** observed directly. Sources: `reference/EVENT_PAGE.md` and
  `reference/MESSENGER_CHAT.md` (one logged-out REA capture of a public Event page; its CSS
  custom properties were read, nothing was copied).
- **[inferred]** follows from what was seen plus general knowledge of the product or Meta's
  public writing.
- **[unknown]** not observable without logging in; our choice is marked as such.

Meta's public sources used:

- *Making it easier to create, discover and share content on Facebook* (about.fb.com, Dec
  2025). The tab bar puts "the most-used Facebook features … like Reels, Friends,
  Marketplace, and Profile" front and centre, and it promises "cleaner tab notifications".
- Press coverage of that rollout describes one bottom bar: Home, Reels, Friends,
  Marketplace, Notifications, Profile, with the tab bar customizable under Settings → Tab
  bar. **[inferred]**: the order isn't given by Meta.
- *Redefining Facebook's brand identity* (design at Meta). Blue stays the foundation of an
  accessibility-tuned palette. Facebook Sans is the brand typeface (brand use, not product
  chrome). No product hex values are published.
- *Rebuilding our tech stack for the new Facebook.com* (engineering.fb.com, 2020). Colours
  are CSS variables defined under a theme class. Sizes are written in px and shipped as rem.
  Icons are inline SVG that take colour from variables.
- Facebook brand resources, logo page: don't design your own wordmark, don't recolour or
  alter the logo, and don't connect other words to it.

## 1. Principles

1. **Content carries the colour.** Chrome is white surfaces on a grey wash, with hairline
   dividers and almost no shadow. Event covers, avatars and photos are the only colour.
2. **One accent, one primary.** Blue `accent` marks the single primary action and the active
   state. Every other button is grey with black text. Each screen has one primary button and
   at most two visible secondary actions. Everything else sits behind a sheet or "See all".
3. **System font, sentence case.** The only capitals are the red date line on events.
4. **Dense and list-like.** Full-width white sections are separated by 8px of wash. Avatars
   are 40px, icon buttons are 36px round, buttons are 36px tall, and touch targets are at
   least 44px.
5. **Stock patterns before invented ones.** Use filter chips, "See all" links, face piles
   with a white ring, equal-width action rows, bottom sheets with a grabber, red count
   badges, grey skeletons and toasts.
6. **Short, functional motion.** 150–250ms ease-out. Sheets slide up and buttons press to
   0.96. Reduced motion is honoured everywhere.
7. **One loud moment: squad found.** The queue can feel like a game queue (a timer, slots
   filling), but it's drawn in Facebook's materials.
8. **AI is labeled, not themed.** Machine-written text carries a small `Sparkles` icon and the
   words "AI" or "Written by AI". There is no colour theme for AI.
9. **Honest prototype.** We use no Meta logos or wordmarks, no Facebook Sans, and no copied
   icons, reaction art or CSS. Every screen shows "Hackathon prototype, not Facebook". Pages
   are `noindex`. Data is seeded only.

## 2. Tokens

Defined once in `app/globals.css` under `@theme`. Pages and feature components use the
Tailwind utilities these tokens generate, never raw hex. Event covers and avatar colours are
content and are exempt. `tests/unit/design-tokens.test.ts` enforces this.

### Colour

| Token | Value | Use | Label |
|---|---|---|---|
| `accent` | `#0866FF` | primary button, active tab, send, progress | [seen] |
| `accent-hover` | `#0866FF` + 5% black overlay | hover/press on primary | [seen token: hover overlay 5% black] |
| `link` | `#0064D1` | links, "See all", on-state text | [seen] |
| `on` | `#EBF5FF` | on-state fill (Interested, Going, active chip) | [seen] |
| `ink` | `#050505` | primary text | [seen] |
| `muted` | `#65676B` | secondary text, icons | [seen] |
| `section` | `#4B4C4F` | section header text in dense lists | [seen] |
| `disabled` | `#BCC0C4` | disabled text | [seen] |
| `wash` | `#F0F2F5` | page wash, composer pill, input fill | [seen] |
| `surface` | `#FFFFFF` | sections, cards, bars, sheets | [seen] |
| `control` | `#E4E6EB` | grey button, chip, empty slot | [seen] |
| `control-hover` | `#D8DADF` | grey button pressed | [inferred: 5% black over `control`] |
| `divider` | `#CED0D4` | hairlines | [seen] |
| `badge` | `#E41E3F` | count badges, negative | [seen] |
| `date` | `#F3425F` | event date line | [seen] |
| `positive` | `#31A24C` | "here", accepted | [seen] |
| `unread` | `#E7F3FF` | unread notification row | [seen] |
| `bubble-in` | `#F0F0F0` | incoming chat bubble | [seen] |
| `scrim` | `rgba(0,0,0,.4)` | behind sheets | [inferred] |

No purple, no gradients in chrome, no glow. The older `#1877F2` blue is retired.

### Shape and elevation

| Token | Value | Label |
|---|---|---|
| `rounded-btn` | 6px (buttons, inputs, chips on desktop) | [seen] |
| `rounded-card` | 8px (cards, sheets' top corners use 12px) | [seen 8px; sheet 12px inferred] |
| `rounded-bubble` | 18px | [seen] |
| pill chips | full | [inferred: mobile filter chips are pills] |
| `shadow-card` | `0 1px 2px rgba(0,0,0,.1)` | [seen] |
| `shadow-elevated` | `0 12px 28px rgba(0,0,0,.2), 0 2px 4px rgba(0,0,0,.1)` (sheets, toasts) | [seen] |

### Type

System stack: `system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif` [seen].
Weights are 400, 600 and 700 (500 for list titles) [seen: 400/500/600/700].

| Token | Size / line height | Use | Label |
|---|---|---|---|
| `text-meta` | 13px / 1.23 | timestamps, counts, helper text | [seen] |
| `text-body` | 15px / 1.33 | body, buttons, list rows | [seen] |
| `text-title` | 17px / 1.29, 600 | top-bar titles, section titles, card titles in lists | [seen 17px/1.2941] |
| `text-headline` | 20px / 1.2, 700 | card headline, sheet title | [seen] |
| `text-page` | 24px / 1.17, 700 | page title, event title | [seen: 24px+] |
| `text-tab` | 11px / 1.2 | tab bar labels | [inferred] |

### Spacing and sizes

4px grid; paddings 8, 12 and 16 [seen]. Top bar 56px [seen]. Tab bar 52px plus the
safe area [inferred]. Section gap: 8px of wash [inferred from the feed]. Avatars: 40 in rows,
56 in chat and notification lists, 32 in face piles [inferred]. Icon buttons are 36px round
[inferred]. Buttons are 36px tall, or 44px for a sticky bottom CTA [seen 36px; 44 inferred].

### Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | everything |
| fast | 150ms | press, hover, chip toggle |
| base | 200ms | toast in, sheet scrim |
| slow | 250ms | sheet slide, slot fill |

Press: `scale(.96)` [inferred]. Reduced motion: animations off, transitions to opacity
only.

## 3. Components (`components/fb/`)

| Component | Spec |
|---|---|
| **TopBar** | 56px, white, hairline bottom border. *Home* variant: our neutral text logotype "Queue Up" (22px/700, `ink`, not blue, no Facebook lettering) at left; at right three 36px round `control` icon buttons: Create, Search, Messages (red count badge). *Section* variant: section title (`text-page`) at left plus Search and Messages. *Back* variant: 40px chevron, `text-title` truncated title, optional right actions. The prototype label sits in a 20px strip under the bar in every variant. |
| **PrototypeLabel** | "Hackathon prototype, not Facebook", 11px `muted` on `wash`, centred. |
| **TabBar** | Fixed bottom, white, hairline top. Six equal tabs: Home, Video, Friends, Events, Notifications, Profile. Lucide icons at 24px with 11px labels. Active tab: `accent` icon and label, a 2.4 stroke and a light fill. Inactive: `muted`, 1.8 stroke. Badge: red pill, white 11px/700, 2px white ring, top-right of the icon. Hidden in chat threads. |
| **Section** | Full-width white block, 16px padding. Optional header row: `text-title` title plus a blue "See all" link at the right. Sections stack on 8px of wash. |
| **Button** | 36px, `rounded-btn`, 15px/600, icon 16–18px with a 6px gap. Variants: `primary` (accent/white), `secondary` (control/ink), `on` (on/link, for toggled states), `ghost` (transparent/link). `size="lg"` is 44px for sticky bottom CTAs. Press scales to .96; disabled uses `disabled` text on `control`. |
| **Chip** | Pill, 32px tall, 12px padding, 15px/600. Off: `control`/ink. On: `on`/`link`. `aria-pressed` or `role=tab`. |
| **ListRow** | Min-height 56px, 8×16 padding. Leading slot (avatar or 36px icon circle in `control`), title 15px/600 (500 when read), subtitle 13px `muted`, trailing slot. Pressed state uses the `wash` fill. An `unread` row uses the `unread` fill. |
| **Sheet** | Bottom sheet, white, 12px top corners, `shadow-elevated`, grabber 36×4 `divider` pill, title `text-headline`, scrim `scrim`. It slides up in 250ms. Closes on scrim tap, Escape or drag handle. `role=dialog`, `aria-modal`, focus trapped. |
| **Badge** | Red count pill (`badge`), min 18px. A `dot` variant is a 10px accent dot (unread). |
| **FacePile** | Overlapping 32px avatars with a 2px white ring at a -8px offset, then an optional "+N" in `muted`. |
| **Skeleton** | `control` blocks, 8px radius, 1.2s opacity pulse (static under reduced motion). |
| **Toast** | White, 8px radius, `shadow-elevated`, 12×16 padding, text `ink`, action in `link`. It sits above the tab bar, slides in, and dismisses after 4s. `role=status`. |
| **Bubble** | 15px, 8×12 padding, `rounded-bubble`. Incoming: `bubble-in`/ink. Outgoing: `accent`/white. Runs stack 2px apart, with joined corners at 4px on the sender's side. Sender's first name (12px `muted`) sits above the first incoming bubble of a run, with a 28px avatar beside the last. Max width 75%. |
| **Composer** | Bottom bar: a pill input (`wash`, 36px, radius 18, placeholder "Aa") and a 36px accent send icon. Enter sends. |
| **AiLabel** | Inline `Sparkles` 12px plus "AI" (or "Written by AI") in 12px `muted`. Used wherever text is machine-written. |
| **Avatar** | Circle with initials on the person's own colour (content), or a photo. Optional 2px white ring. A `blurred` state blurs initials and colour until the squad is confirmed. |

### Feature components (built only from `components/fb/`)

- **EventCard**: a white card with `rounded-card`. Cover (16:9-ish, content), then the date
  line (13px/600 `date`, uppercase), title (17px/600, 2 lines max), venue · distance (13px
  `muted`), "N friends interested · N going" (13px `muted`), then a full-width grey
  "Interested" button plus a 36px share button. [inferred from EVENT_PAGE §5]
- **EventHeader**: cover; date line; title (`text-page`); venue line; host line.
- **ActionRow**: equal-width grey buttons, Interested (star), Going (check), Invite (mail),
  plus a 36px "…" button. On state is `on`/`link`. [inferred from EVENT_PAGE §4]
- **QueueEntry** ("Go with a squad", the Events tab feed unit and the event page unit):
  - A 40px `on`-circle icon, a title, one line of copy, and the queue pulse. The pulse is counts
    only, shown at 5 or more; it never shows faces of people queuing.
  - One primary button that opens the **QueueSheet**.
  - It shares one slot with the StatusCard; the two never stack.
- **QueueSheet**: a two-step bottom sheet.
  - Step 1 lists the three queue modes as ListRows: an event you pick (your Interested events
    first), any event this weekend, a new hangout.
  - Step 2 is setup: squad size chips (4, 5 or 6), "where you'll start from" (location once, or
    choose an area), one safety line, and a sticky "Find my squad".
  - The event page opens straight at step 2.
- **StatusCard**: the single card showing the user's Queue Up state: waiting → squad ready → at
  the venue → after. It always has exactly one next action. It appears at the top of the Events
  tab and on the event page it concerns.
- **QueueScreen**:
  - Back bar; an event row (icon, title, "Near {area} · squad of N").
  - A 34px tabular timer in the system font, and "3 of 5 found" with an accent progress bar.
  - Slots: other people are blurred until the squad is ready; empty slots are dashed `divider`
    circles.
  - A "While you wait" list with three plain safety rows, and "Leave queue" as a grey button.
- **SquadFound** (the loud moment):
  - A white page. An 88px accent circle with a white check scales in once, with a single ring.
  - "Your squad is ready" (`text-page`). Members pop in staggered (48px, one row), and sample
    people are labeled.
  - The event attachment, then a "How we matched you" row.
  - Primary "Open squad chat".
- **TraceList** ("How we matched you"), in a sheet:
  - Two groups, **Written by AI** and **Checked by code**. Each AI line says where it came from:
    written just now, a saved AI response, the test model, or a template because AI was
    unavailable.
  - No stagger and no tool-call names.
- **Squad info** (`/squad/[id]`), modelled on Messenger's chat info:
  - Face pile, squad name and event line.
  - Round actions: Chat, Event, I'm here.
  - Plan rows; rows for Talk cards, Find each other and How we matched you; a member list
    (sample people labeled).
- **Chat thread**:
  - Messenger header: back, face pile, name, "N members · ends in…", and an info button.
  - A pinned plan strip.
  - Grey and blue bubbles in runs. The AI host is a plain grey incoming bubble with "Queue Up
    host" and an AI label.
  - Quick-reply chips: Ask the host, Talk cards, Find each other. "Aa" composer.
  - The tab bar steps aside.

## 4. States

| State | Treatment |
|---|---|
| Hover / press | 5% black overlay; press scales to .96 [seen/inferred] |
| Focus | 2px `accent` ring, 2px offset [seen token: focus ring] |
| On (toggled) | `on` fill, `link` text and icon [seen] |
| Disabled | `disabled` text; no pointer [seen] |
| Loading | Skeleton blocks in the shape of the content [seen token: glimmer] |
| Empty | Centred 15px `muted` copy with one action |
| Error | Section with a title, one line and a "Try again" grey button |
| Unread | `unread` row fill, a bold title and a blue dot [seen] |
| AI text | `AiLabel` above or below it |

## 5. Do and don't

**Do**
- Put colour in content (covers, avatars) and keep chrome white and grey.
- Use one blue button per screen, with everything else grey.
- Use sentence case everywhere except the red date line.
- Reach for a stock Facebook pattern before inventing one.
- Label AI text in words.
- Keep the prototype label and `noindex` on every page.

**Don't**
- Use gradients, purple, glow, glass, shimmer borders, confetti, letter-spaced capitals,
  monospace, or emoji or ✦ as icons.
- Use dark full-bleed "gaming" screens.
- Use the Facebook wordmark, the "f" logo, Facebook Sans, reaction art or copied icons.
- Build a screen that resembles Facebook's login, or anything that asks for a password or
  real account details.
- Use raw hex in pages or feature components (covers and avatars excepted), or one-off
  shadows.
- Add decorative motion, or motion that ignores reduced-motion settings.
