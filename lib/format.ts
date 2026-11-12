const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19:30" -> "7:30 PM". Timezone-free on purpose. */
export function clock12(c: string): string {
  const [h, m] = c.split(":").map(Number) as [number, number];
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${suffix}` : `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2026-11-14" -> "Sat, Nov 14" */
export function dayLabel(date: string): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${DAYS[dow]}, ${MONTHS[mo - 1]} ${d}`;
}

export function eventWhen(date: string, start: string, end?: string): string {
  return `${dayLabel(date).toUpperCase()} AT ${clock12(start)}${end ? ` – ${clock12(end)}` : ""}`;
}

/** Minutes after midnight on an evening scale: times before 6 AM count
 *  as after midnight of the same evening ("01:00" -> 1500). */
export function eveningMinutes(c: string): number {
  const [h, m] = c.split(":").map(Number) as [number, number];
  return (h < 6 ? h + 24 : h) * 60 + m;
}

export function price(usd: number): string {
  return usd === 0 ? "Free" : `$${usd}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function chatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}
