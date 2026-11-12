// No path aliases here: imported directly by tests.
/** "18:30", "6:30 PM", "6:30pm" → minutes after midnight. */
export function parseTime(t: unknown): number | null {
  const m = String(t ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}
