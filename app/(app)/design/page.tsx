import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, House, Info, Mail, MapPin, MessageCircle, MonitorPlay, MoreHorizontal, Pin, Plus, Search, Star, Users, X } from "lucide-react";
import { PrototypeLabel, TopBar } from "@/components/fb/TopBar";
import {
  AiLabel,
  Avatar,
  Badge,
  Bubble,
  Button,
  ButtonLink,
  Card,
  Chip,
  ChipLink,
  ChipRow,
  Divider,
  FacePile,
  IconButton,
  IconCircle,
  ListRow,
  Section,
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  Stack,
  SystemLine,
} from "@/components/fb";
import { GalleryDemos } from "@/components/design/GalleryDemos";
import { DateLine } from "@/components/events/DateLine";

/**
 * /design: every components/fb part in every state, and one example of each page template (DESIGN.md
 * "Page templates"). tests/e2e/design.spec.ts measures the specimens here against the tokens.
 * Template: detail page (back TopBar, then a Stack of Sections).
 */
export const metadata: Metadata = {
  title: "Design system · Queue Up prototype",
  robots: { index: false, follow: false },
};

const COLOURS = [
  ["accent", "bg-accent"],
  ["link", "bg-link"],
  ["on", "bg-on"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["section", "bg-section"],
  ["disabled", "bg-disabled"],
  ["wash", "bg-wash"],
  ["surface", "bg-surface"],
  ["control", "bg-control"],
  ["control-hover", "bg-control-hover"],
  ["divider", "bg-divider"],
  ["badge", "bg-badge"],
  ["date", "bg-date"],
  ["positive", "bg-positive"],
  ["unread", "bg-unread"],
  ["bubble-in", "bg-bubble-in"],
  ["scrim", "bg-scrim"],
] as const;

const TYPE = [
  ["timer", "text-timer font-semibold", "0:42"],
  ["page", "text-page font-bold", "Your squad is ready"],
  ["headline", "text-headline font-bold", "Find a squad"],
  ["title", "text-title font-semibold", "Friends queuing"],
  ["body", "text-body", "Meet at the door and walk in together."],
  ["meta", "text-meta text-muted", "Sat, Nov 14 · 5 people"],
  ["tab", "text-tab text-muted", "Notifications"],
] as const;

const RADII = [
  ["btn", "rounded-btn", "6px"],
  ["card", "rounded-card", "8px"],
  ["sheet", "rounded-sheet", "12px"],
  ["bubble", "rounded-bubble", "18px"],
  ["full", "rounded-full", "pill"],
] as const;

/** A fixed sample date, so the specimen never depends on the demo clock. */
const SAMPLE_START = new Date("2026-11-14T19:30:00-08:00");

const VARIANTS = ["primary", "secondary", "on", "ghost", "positive"] as const;
const SIZES = ["sm", "md", "lg"] as const;

const PEOPLE = [
  { id: "a", name: "Yuki Dubois", avatarColor: "var(--color-accent)" },
  { id: "b", name: "Rosa Cohen", avatarColor: "var(--color-badge)" },
  { id: "c", name: "Gabe Chen", avatarColor: "var(--color-positive)" },
  { id: "d", name: "Ben Patel", avatarColor: "var(--color-section)" },
  { id: "e", name: "Ari Moreau", avatarColor: "var(--color-link)" },
  { id: "f", name: "Zoe Park", avatarColor: "var(--color-date)" },
  { id: "g", name: "Reza Ali", avatarColor: "var(--color-muted)" },
];

function Spec({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <p className="text-meta text-muted">
        <span className="font-semibold text-ink">{name}</span>
        {note && <> · {note}</>}
      </p>
      {children}
    </div>
  );
}

/** A page template drawn small: the real parts, inert (not focusable, not in the accessibility tree). */
function Template({ id, name, href, model, stack, tall = false, children }: { id: string; name: string; href: string; model: string; stack: string; tall?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3" data-testid={`template-${id}`}>
      <div className="flex items-baseline justify-between gap-3 px-4">
        <p className="text-title font-semibold">{name}</p>
        <Link href={href} className="text-meta text-link">
          Model: {model}
        </Link>
      </div>
      <p className="px-4 text-meta text-muted">{stack}</p>
      {/* Full width, so each template is drawn at the real 390px screen width. */}
      <div inert className={`relative ${tall ? "h-112" : "h-96"} transform-gpu overflow-hidden border-y border-divider bg-wash`}>
        {children}
      </div>
    </div>
  );
}

function StaticTabBar() {
  const tabs = [
    ["Home", House],
    ["Video", MonitorPlay],
    ["Friends", Users],
    ["Events", CalendarDays],
    ["Notifications", Bell],
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 grid h-13 grid-cols-6 border-t border-divider bg-surface text-tab text-muted">
      {tabs.map(([label, Icon]) => (
        <span key={label} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 ${label === "Events" ? "font-semibold text-accent" : ""}`}>
          <Icon size={24} strokeWidth={label === "Events" ? 2.4 : 1.8} />
          <span className="max-w-full truncate">{label}</span>
        </span>
      ))}
      <span className="flex flex-col items-center justify-center gap-0.5">
        <Avatar name="Jordan Lee" color="var(--color-accent)" size={24} />
        <span>Profile</span>
      </span>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div data-testid="design-gallery">
      <TopBar back="/demo" title="Design system" />
      <Stack className="pb-6">
        <Section>
          <p className="text-body">
            Every part in <span className="font-semibold">components/fb</span>, in every state, and one example of each page template. The rules are in
            DESIGN.md: build pages only from these parts, and keep one primary button per screen.
          </p>
          <p className="mt-2 text-meta text-muted">This page shows several primary buttons on purpose; it is a specimen sheet, not a screen.</p>
        </Section>

        <Section title="Colour" testId="spec-colours">
          <div className="grid grid-cols-2 gap-3">
            {COLOURS.map(([name, cls]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={`h-8 w-8 shrink-0 rounded-card border border-divider ${cls}`} data-testid={`spec-color-${name}`} />
                <span className="truncate text-meta">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type" testId="spec-type">
          {TYPE.map(([name, cls, sample]) => (
            <div key={name} className="flex items-baseline justify-between gap-3 py-1">
              <span className={`min-w-0 truncate ${cls}`} data-testid={`spec-text-${name}`}>
                {sample}
              </span>
              <span className="shrink-0 text-meta text-muted">text-{name}</span>
            </div>
          ))}
        </Section>

        <Section title="Shape and elevation">
          <div className="flex flex-wrap gap-3">
            {RADII.map(([name, cls, v]) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <span className={`h-12 w-12 bg-control ${cls}`} data-testid={`spec-radius-${name}`} />
                <span className="text-meta text-muted">
                  {name} {v}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <span className="h-12 w-12 rounded-card bg-surface shadow-card" data-testid="spec-shadow-card" />
              <span className="text-meta text-muted">shadow-card</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="h-12 w-12 rounded-card bg-surface shadow-elevated" data-testid="spec-shadow-elevated" />
              <span className="text-meta text-muted">elevated</span>
            </div>
          </div>
        </Section>

        <Section title="Button" testId="spec-buttons">
          {VARIANTS.map((v) => (
            <Spec key={v} name={v} note={v === "primary" ? "one per screen" : v === "on" ? "toggled state" : undefined}>
              <div className="flex flex-wrap items-center gap-2">
                {SIZES.map((s) => (
                  <Button key={s} variant={v} size={s} data-testid={`spec-button-${v}-${s}`}>
                    {s === "lg" ? "Find my squad" : s === "md" ? "Interested" : "Add"}
                  </Button>
                ))}
              </div>
            </Spec>
          ))}
          <Spec name="with icon, disabled, link, block">
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<Star size={16} />}>Interested</Button>
              <Button variant="primary" disabled data-testid="spec-button-disabled">
                Share
              </Button>
              <ButtonLink href="/events" variant="ghost">
                See all
              </ButtonLink>
            </div>
            <Button variant="secondary" block icon={<Users size={16} />}>
              Edit profile
            </Button>
          </Spec>
          <Spec name="IconButton" note="36px round; with a count badge">
            <div className="flex items-center gap-2">
              <IconButton label="Search">
                <Search size={20} strokeWidth={2.4} />
              </IconButton>
              <IconButton label="Create">
                <Plus size={20} strokeWidth={2.4} />
              </IconButton>
              <IconButton label="Messages, 3 new" badge={<Badge count={3} className="absolute -top-1 -right-1" />}>
                <MessageCircle size={20} strokeWidth={2.4} />
              </IconButton>
            </div>
          </Spec>
        </Section>

        <Section title="Chip">
          <Spec name="Chip" note="toggle; aria-pressed">
            <div className="flex gap-2">
              <Chip on={false} data-testid="spec-chip-off">
                4 people
              </Chip>
              <Chip on data-testid="spec-chip-on">
                5 people
              </Chip>
            </div>
          </Spec>
          <Spec name="ChipRow + ChipLink" note="filters; role=tab; scrolls sideways">
            <ChipRow label="Event filters">
              <ChipLink on href="/events">
                For you
              </ChipLink>
              <ChipLink on={false} href="/events?tab=nearby">
                Local
              </ChipLink>
              <ChipLink on={false} href="/events?tab=weekend">
                This weekend
              </ChipLink>
            </ChipRow>
          </Spec>
        </Section>

        <Section title="Badge, Avatar, FacePile">
          <Spec name="Badge" note="red count (9+ above nine), blue for chats, dot for unread">
            <div className="flex items-center gap-4">
              <Badge count={1} />
              <Badge count={12} />
              <Badge count={3} tone="blue" />
              <Badge dot />
            </div>
          </Spec>
          <Spec name="Avatar" note="initials on the person's colour; 24 tab · 32 pile · 40 row · 56 list">
            <div className="flex items-center gap-3">
              <Avatar name="Jordan Lee" color="var(--color-accent)" size={24} />
              <Avatar name="Jordan Lee" color="var(--color-accent)" size={32} />
              <span data-testid="spec-avatar-40">
                <Avatar name="Jordan Lee" color="var(--color-accent)" />
              </span>
              <Avatar name="Jordan Lee" color="var(--color-accent)" size={56} />
              <Avatar name="Yuki Dubois" color="var(--color-badge)" ring />
              <Avatar name="Yuki Dubois" color="var(--color-badge)" blurred />
              <Avatar name="Yuki Dubois" color="var(--color-badge)" dim />
            </div>
          </Spec>
          <Spec name="FacePile" note="white ring, overlap, +N; blurred until the squad is ready">
            <div className="flex items-center gap-4">
              <FacePile people={PEOPLE.slice(0, 3)} />
              <FacePile people={PEOPLE} max={4} />
              <FacePile people={PEOPLE.slice(0, 4)} blurred />
            </div>
          </Spec>
        </Section>

        <Section title="ListRow" flush>
          <ListRow testId="spec-listrow" leading={<Avatar name="Freya Rossi" color="var(--color-link)" />} title="Freya Rossi" subtitle="Queuing for Golden Hour Photo Walk" />
          <ListRow leading={<Avatar name="Zoe Park" color="var(--color-date)" size={56} />} title="Zoe Park sent you a friend request." meta="3h" unread trailing={<Badge dot />} />
          <ListRow
            leading={<IconCircle><Calendar size={20} /></IconCircle>}
            title="For an event you pick"
            subtitle="Your squad goes to that event together."
            trailing={<ChevronRight size={20} className="text-muted" />}
            href="/events"
          />
          <ListRow leading={<IconCircle tone="on"><Users size={20} /></IconCircle>} title="Go with a squad" subtitle="tone on" bold />
          <ListRow leading={<IconCircle tone="positive"><Check size={20} /></IconCircle>} title="You're here" subtitle="tone positive" />
          <ListRow leading={<IconCircle tone="accent"><MapPin size={20} /></IconCircle>} title="Disabled row" subtitle="opacity 60%, no pointer" disabled />
        </Section>

        <Section title="Section, Card, Divider, Skeleton" seeAll={{ href: "/events" }}>
          <Card className="p-3">
            <p className="text-body font-semibold">A card</p>
            <p className="text-meta text-muted">White, 8px radius, hairline border. Used for event cards and quoted content.</p>
          </Card>
          <Divider className="my-3" />
          <div className="flex flex-col gap-2" aria-label="Loading example">
            <Skeleton className="h-4 w-2/3" />
            <SkeletonRow />
            <SkeletonCard />
          </div>
        </Section>

        <Section title="Chat parts">
          <ul className="flex flex-col gap-0.5">
            <SystemLine>Queue Up formed your squad of 5. This chat disappears 24h after the event.</SystemLine>
            <li className="flex flex-col items-start gap-0.5">
              <span className="flex items-center gap-1.5 px-3 text-meta text-muted">
                Queue Up host <AiLabel>AI</AiLabel>
              </span>
              <Bubble mine={false} pos="first">Hi all, I&apos;m the Queue Up host, an AI.</Bubble>
              <Bubble mine={false} pos="last">Ask me anything with @host.</Bubble>
            </li>
            <li className="flex flex-col items-end gap-0.5 pt-2">
              <Bubble mine pos="first">See you at the front entrance</Bubble>
              <Bubble mine pos="last">I&apos;m in a green jacket</Bubble>
            </li>
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <AiLabel />
            <span className="text-meta text-muted">· the label for any machine-written text</span>
          </div>
        </Section>

        <Section title="Interactive" testId="spec-feedback">
          <GalleryDemos />
        </Section>

        <Section title="Top bar and prototype label">
          <p className="mb-2 text-meta text-muted">
            The bar at the top of this page is the back variant. The live tab bar is at the bottom. Home and section variants:
          </p>
          <div inert className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-card border border-divider" data-testid="spec-topbar-home">
              <TopBar variant="home" />
            </div>
            <div className="overflow-hidden rounded-card border border-divider">
              <TopBar title="Events" />
            </div>
            <div className="overflow-hidden rounded-card border border-divider">
              <PrototypeLabel />
            </div>
          </div>
        </Section>

        <Section title="Page templates" flush>
          <p className="px-4 text-meta text-muted">A new page is one of these five. A sixth needs a contract-change pull request.</p>

          <Template id="tab-root" name="1. Tab root" href="/events" model="/events" stack="TopBar (section) · ChipRow · Stack of Sections · TabBar">
            <TopBar title="Events" />
            <div className="bg-surface px-4 py-2">
              <ChipRow label="Event filters (example)">
                <ChipLink on href="/events">For you</ChipLink>
                <ChipLink on={false} href="/events?tab=nearby">Local</ChipLink>
                <ChipLink on={false} href="/events?tab=weekend">This weekend</ChipLink>
              </ChipRow>
            </div>
            <Stack className="mt-2">
              <Section title="Go with a squad">
                <p className="text-meta text-muted">Queue for an event and we&apos;ll match you.</p>
                <Button variant="primary" block className="mt-2">
                  Find a squad
                </Button>
              </Section>
              <Section title="Suggested for you" seeAll={{ href: "/events" }}>
                <SkeletonRow />
              </Section>
            </Stack>
            <StaticTabBar />
          </Template>

          <Template id="detail" name="2. Detail page" href="/events/ev-indie-guild" model="/events/ev-indie-guild" stack="TopBar (back) · cover · title block · ActionRow · Sections · one primary · TabBar">
            <TopBar back title="Indie Night" />
            <div className="h-12 bg-control" />
            <div className="bg-surface px-4 py-3">
              <DateLine start={SAMPLE_START} />
              <p className="text-page font-bold">Indie Night</p>
              <div className="mt-2 flex gap-2">
                <Button className="min-w-0 flex-1" icon={<Star size={16} />}><span className="truncate">Interested</span></Button>
                <Button className="min-w-0 flex-1" icon={<Check size={16} />}><span className="truncate">Going</span></Button>
                <Button className="min-w-0 flex-1" icon={<Mail size={16} />}><span className="truncate">Invite</span></Button>
                <IconButton label="More"><MoreHorizontal size={20} /></IconButton>
              </div>
            </div>
            <Section className="mt-2" title="Going alone?">
              <Button variant="primary" block>
                Find a squad to go with
              </Button>
            </Section>
            <StaticTabBar />
          </Template>

          <Template id="sheet" name="3. Bottom-sheet flow" href="/events/ev-indie-guild" model="/events/ev-indie-guild, Queue Up" stack="the page under a scrim · Sheet: grabber, title and close, a short form, sticky primary" tall>
            <TopBar back title="Indie Night" />
            <div className="absolute inset-0 bg-scrim" />
            <div className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-surface pb-3 shadow-elevated">
              <span className="mx-auto mt-2 block h-1 w-9 rounded-full bg-divider" />
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <p className="text-headline font-bold">Indie Night</p>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-control"><X size={20} /></span>
              </div>
              <div className="px-4">
                <p className="text-body font-semibold">Squad size</p>
                <div className="mt-1.5 flex gap-2">
                  <Chip on={false}>4 people</Chip>
                  <Chip on>5 people</Chip>
                  <Chip on={false}>6 people</Chip>
                </div>
              </div>
              <ListRow leading={<IconCircle><MapPin size={20} /></IconCircle>} title="Choose an area instead" trailing={<ChevronRight size={20} className="text-muted" />} />
              <div className="px-4 pt-1">
                <Button variant="primary" size="lg" block>
                  Find my squad
                </Button>
              </div>
            </div>
          </Template>

          <Template id="chat" name="4. Chat thread" href="/chats" model="/chats/[id], any squad chat" stack="Messenger header · PrototypeLabel · pinned plan · Bubbles · quick-reply Chips · Composer (no TabBar)">
            <div className="flex h-14 items-center gap-2 border-b border-divider bg-surface px-3">
              <ChevronLeft size={28} className="text-accent" />
              <FacePile people={PEOPLE.slice(0, 2)} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold">Indie Night Squad</p>
                <p className="text-meta text-muted">5 members · Ends in 3d</p>
              </div>
              <Info size={24} className="text-accent" />
            </div>
            <PrototypeLabel />
            <div className="flex items-center gap-2 border-b border-divider bg-surface px-4 py-2 text-meta">
              <Pin size={16} className="text-muted" /> Sat, Nov 14 · Meet at the front entrance
            </div>
            <div className="flex flex-col items-start gap-0.5 bg-surface px-3 py-3">
              <span className="flex items-center gap-1.5 px-3 text-meta text-muted">
                Queue Up host <AiLabel>AI</AiLabel>
              </span>
              <Bubble mine={false}>Hi all, I&apos;m the Queue Up host, an AI.</Bubble>
              <span className="self-end pt-1">
                <Bubble mine>See you there</Bubble>
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-surface">
              <div className="flex gap-2 px-3 pt-2">
                <Chip on={false}>Ask the host</Chip>
                <Chip on={false}>Talk cards</Chip>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="h-9 flex-1 rounded-full bg-wash px-4 text-body leading-9 text-muted">Aa</span>
              </div>
            </div>
          </Template>

          <Template id="moment" name="5. The full-screen moment" href="/queue" model="/queue, when the squad is ready" stack="TopBar (back) · 88px check · page title · one row of 48px faces · event Card · one primary · TabBar" tall>
            <TopBar back title="Your squad" />
            <div className="flex flex-col items-center gap-3 bg-surface px-4 py-4 text-center">
              <IconCircle tone="accent" size={88}>
                <Check size={44} strokeWidth={3} />
              </IconCircle>
              <p className="text-page font-bold">Your squad is ready</p>
              <div className="flex gap-2">
                {PEOPLE.slice(0, 5).map((p) => (
                  <Avatar key={p.id} name={p.name} color={p.avatarColor} size={48} />
                ))}
              </div>
              <Card className="w-full p-3 text-left">
                <DateLine start={SAMPLE_START} />
                <p className="text-body font-semibold">Indie Night: Local Bands Showcase</p>
              </Card>
              <Button variant="primary" block icon={<MessageCircle size={16} />}>
                Open squad chat
              </Button>
            </div>
            <StaticTabBar />
          </Template>
        </Section>
      </Stack>
    </div>
  );
}
