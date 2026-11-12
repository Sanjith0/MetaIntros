import Link from "next/link";
import { IconCalendar, IconChat, IconCheck, IconDoor, IconHome, IconSearch, IconSparkle, IconTicket, IconUsers } from "@/components/icons";

const CATEGORIES = ["Arts", "Crafts", "Food & drink", "Games", "Music & audio", "Nature", "Outdoors", "Science", "Social"];

/** Left rail of the Events tab: heading, search, nav rows, categories. */
export function EventsRail({ active = "home" }: { active?: "home" | "yours" | "party" }) {
  const row = (key: string, href: string, label: string, icon: React.ReactNode, layer = false) => (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[8px] px-2 py-2 hover:bg-black/5 ${active === key ? "bg-black/5" : ""}`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${active === key ? "bg-[var(--color-accent)] text-white" : layer ? "bg-[var(--color-pq-soft)] text-[var(--color-pq)]" : "bg-[var(--color-btn-2)] text-[var(--color-ink)]"}`}
      >
        {icon}
      </span>
      <span className="text-[15px] font-semibold">{label}</span>
      {layer && <span className="ml-auto rounded bg-[var(--color-pq-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-pq)]">Layer</span>}
    </Link>
  );
  return (
    <aside className="hidden w-[360px] shrink-0 flex-col gap-1 overflow-y-auto bg-white px-2 py-3 shadow-[1px_0_2px_rgb(0_0_0/0.06)] lg:flex" style={{ height: "calc(100vh - 56px)", position: "sticky", top: 56 }}>
      <h1 className="px-2 pb-2 text-[24px] font-bold">Events</h1>
      <div className="mx-2 mb-2 flex h-9 items-center gap-2 rounded-full bg-[var(--color-wash)] px-3 text-[var(--color-ink-2)]">
        <IconSearch size={16} />
        <span className="text-[15px]">Search events</span>
      </div>
      {row("home", "/events", "Home", <IconHome size={20} />)}
      {row("yours", "/events?tab=yours", "Your events", <IconCalendar size={20} />)}
      {row("party", "/party", "Your party", <IconSparkle size={20} />, true)}
      {row("door", "/door", "At the door", <IconDoor size={20} />, true)}
      {row("runitback", "/runitback", "Run it back", <IconUsers size={20} />, true)}
      {row("fair", "/fair", "Fair QR join", <IconTicket size={20} />, true)}
      {row("stage", "/stage", "Stage (projector)", <IconChat size={20} />, true)}
      {row("safety", "/safety", "Safety", <IconCheck size={20} />, true)}
      {row("how", "/how", "How it works", <IconSparkle size={20} />, true)}
      <div className="mx-2 my-2 border-t border-[var(--color-divider)]" />
      <div className="px-2 pb-1 text-[17px] font-semibold">Categories</div>
      {CATEGORIES.map((c) => (
        <div key={c} className="flex items-center gap-3 rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-black/5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-btn-2)] text-[13px] font-bold text-[var(--color-ink-2)]">{c[0]}</span>
          {c}
        </div>
      ))}
    </aside>
  );
}
