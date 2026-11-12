# Reference: Event page and Events tab

Source: REA (`rea-agents` 6.8.0, `capture-browser-scenario`, launch mode with REA's own
temporary profile, headless, logged out, 1280x900 viewport). Two page loads in total:

1. The events discovery URL returned a bare "Not Found" document when logged out.
2. One public Event page (marked "Public, anyone on or off Facebook"; id withheld). The event
   layout rendered, but a login dialog covered the centre of the page. Nobody logged in.

Raw captures were analysed in a scratch folder and deleted. No names, photos, ids, source
code, icons, fonts or images were kept. Everything below is described in our own words.

Labels: **[seen]** observed in the capture (screenshot, DOM tokens or accessibility tree).
**[inferred]** follows from what was seen plus general knowledge of the product.
**[unknown]** not observable logged out.

---

## 1. Page frame

| Region | Notes | Label |
|---|---|---|
| Top bar | Full width, 56px tall, white, hairline bottom shadow. Wordmark at left. When logged out the right side holds email, password, a primary "Log In" button and a recovery link. | [seen] |
| Top bar, logged in | Search pill at left, centre nav icons, right cluster of round buttons (menu, Messenger, notifications, avatar). | [inferred] |
| Left rail | About 360px wide on a 1280px viewport, page-wash background. A large bold "Events" heading, a rounded search field ("Search events"), a "Home" nav row, a divider, then a "Categories" section heading and a long list of category rows (icon in a grey circle plus label). | [seen] |
| Main column | Page-wash background. A centred content column about 940px wide that holds the cover, the header block, the action bar and the cards. | [seen] |
| Login dialog | Centred white card, 8px radius, heavy elevation shadow, close button at top right, title "See more on Facebook", two inputs, a full-width primary button, a link and a green secondary button. Shown to every logged-out viewer. | [seen] |

Our shell: we copy the frame (top bar, left rail, main column) but never show a login
dialog. A demo user switcher sits in the top bar instead.

## 2. Event page, top to bottom (main column)

1. **Cover** [seen]: a wide media block, about 16:9 within the centre column, 8px bottom
   corners. Behind it a blurred, colour-washed copy of the same image fills the full main
   width (the "ambient" header).
2. **Header block** [seen in part, behind the dialog]:
   - Date line in the event-date red, small caps feel, uppercase-ish weight 600 [inferred].
   - Title, very large and bold (about 28-32px, weight 700) [inferred from the visible size].
   - Venue or location line in secondary grey [inferred].
3. **Action bar** [seen]: a hairline divider above. Left side holds the tab row
   ("About", "Discussion"; the active tab gets a 3px accent underline, tab height 60px) [seen].
   Right side holds grey secondary buttons: "Invite" with an envelope icon, a share icon
   button, and an overflow "..." button [seen]. For a logged-in viewer the primary
   response buttons sit here: **Interested** (star icon) and **Going** (check icon) [inferred;
   both labels were absent from the logged-out DOM].
4. **Two-column body** [seen]:
   - Left, wider: the **Details** card. Rows with a leading 20px grey icon:
     "N people responded" [seen in DOM], "Event by" plus host links [seen], location
     [inferred], privacy row "Public · Anyone on or off Facebook" [seen], duration [seen in DOM].
     Then the free-text description, clamped with a "See more" link [seen], then category
     chips such as "Music & audio" (grey chip, 6px radius) [seen].
   - Then a "Meet your hosts" card and a "Guests" card [inferred].
   - Right, narrower: a map/location card, then "Suggested events" [seen in DOM].

## 3. Guest list (Guests card)

- [inferred] Card titled "Guests" with a "See all" link at top right.
- [inferred] Two big counters side by side: a number over "Going" and a number over
  "Interested", each tappable to open a dialog with tabs (Going / Interested / Invited).
- [inferred] A face pile: overlapping 32-36px circular avatars with a 2px white ring,
  plus a line such as "Two friends are going".
- [unknown] Exact counts layout logged-in; the logged-out page showed only
  "N people responded".

## 4. Interaction states

| State | Behaviour | Label |
|---|---|---|
| Default | Interested and Going render as grey secondary buttons (secondary-button-background, 6px radius, 36px tall, icon + label, 15px weight 600). | [inferred] |
| Interested on | Interested turns to the deemphasised-primary look: light blue fill (#EBF5FF) with blue text/icon (#0064D1). Counter increments. | [inferred] |
| Going on | Going takes the same light blue on state; the button opens a small menu (Going / Interested / Not going). Only one of the two is active. | [inferred] |
| Hover | A 5% black overlay over any button or list row. | [seen token] |
| Pressed | Slight scale-down (about 0.96) on tap. | [inferred] |
| Focus | A 2px ring in the focus blue. | [seen token] |
| Disabled | Text in the disabled grey (#BCC0C4). | [seen token] |
| Guest list open | Modal dialog, 8px radius, header with tabs, scrolling list of person rows (avatar 40px, name, a mutual-friend line, a trailing button). | [inferred] |
| Loading | Grey shimmering placeholder blocks with 8px radius. | [seen token: glimmer] |

## 5. Events tab (the discovery surface)

- [seen] Left rail as in section 1: "Events" heading, search, Home, Categories.
- [inferred] Logged in, the rail adds "Your events", "Notifications", a "Create new event"
  button (light blue, full width), and the main column shows a grid of event cards.
- [inferred] Event card: cover image on top with 8px top corners, then date line in
  event-date red (13px, weight 600), title (17px, weight 600, two lines max), venue line
  and "N interested · N going" in secondary grey (13px), then a full-width grey
  "Interested" button. Cards are about 250-280px wide, 3-4 per row, 8px gaps.
- [unknown] Exact grid breakpoints; the logged-out discovery URL returned Not Found.

## 6. Design tokens (from the page's own CSS custom properties) [seen]

Colours
- Primary button and accent blue: #0866FF. Primary button text: white.
- Link blue: #0064D1. Older brand blue still present: #1877F2.
- Deemphasised primary (the "on" state): background #EBF5FF, text #0064D1.
- Primary text: #050505. Secondary text and icons: #65676B. Section headers: #4B4C4F.
- Disabled text: #BCC0C4. Placeholder: #65676B.
- Page wash (behind cards): #F0F2F5. Card and surface: #FFFFFF. Top bar: #FFFFFF.
- Secondary (grey) button: #E4E6EB. Dividers: #CED0D4.
- Positive green: #31A24C. Negative red: hsl(350, 87%, 55%). Badge red: #E41E3F.
- Event date red: #F3425F.
- New-notification highlight background: #E7F3FF.
- Hover overlay: 5% black. Media inner border: 10% black.

Shape and elevation
- Radii: button 6px, input 6px, chip 6px, card 8px, dialog 8px, toast 8px, image 4px,
  list cell 8px, medium button 10px, large button 12px, comment bubble 18px.
- Card shadow (small): 0 1px 2px 10% black.
- Elevated shadow (menus, dialogs): 0 12px 28px 20% black plus 0 2px 4px 10% black.

Type
- System font stack (system-ui, -apple-system, then Segoe UI, Helvetica, Arial).
- Body 15px with line height about 1.33; small meta 13px; input labels 17px; headings
  20px (card titles, weight 700) and 24px+ for the page title. Weights used: 400, 500,
  600, 700. Line-height ratio seen: 1.2941 at 17px.

Spacing
- Base unit 4px; most common paddings in the page CSS were 8px, then 16px, then 12px and 6px.
- Card inner padding 16px; section header vertical padding 16px (dense 8px).
- Top bar height 56px. Tab height 60px, tab underline 3px, tab text-icon gap 4px.

Toasts [seen tokens]
- White background, text #1C2B33, link #216FDB, 8px radius, min width 288px, max width
  328px, padding 16px vertical and 10px horizontal, elevated shadow. Bottom-left on desktop
  [inferred].

## 7. Data each region needs

| Region | Data |
|---|---|
| Top bar | current viewer (name, avatar initial), unread notification count |
| Left rail | category list, viewer's events count |
| Cover | cover image or colour, title |
| Header | start date/time, title, venue name, city |
| Action bar | viewer's response (none / interested / going), share URL |
| Details | responded count, host names (links), venue, privacy, duration, description, category chips |
| Guests | going count, interested count, up to 6 faces, mutual-friend line for the viewer |
| Right rail | location (map placeholder), suggested events (id, title, date) |
| Events tab card | id, cover, date, title, venue, interested count, going count, viewer response |

## 8. What we build (our own components, our own names)

- `TopBar` (56px, white, our own text logotype that is not the real wordmark, the
  "Hackathon prototype, not Facebook" label, the user switcher).
- `LeftRail`, `EventCover`, `EventHeader`, `ActionBar` with `RsvpButtons` (Interested,
  Going), `DetailsCard`, `GuestsCard`, `GuestListDialog`, `EventCard`.
- Our layer on top: a primary blue **Find my party** button in the action bar, the queue
  sheet that slides up from it, the party card and the MATCH FOUND toast. These use the
  same tokens but carry a small "Party Queue" tag so they read as a layer.
