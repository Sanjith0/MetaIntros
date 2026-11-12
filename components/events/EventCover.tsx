/*
 * Event covers are content, standing in for an event photo: the colour and pattern come from the event's data.
 * This is the one place pattern overlays live (exempt from the no-raw-colour check, like avatars).
 */
const PATTERNS: Record<string, string> = {
  dots: "radial-gradient(rgba(255,255,255,.25) 2px, transparent 2.5px) 0 0/16px 16px",
  grid: "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px) 0 0/20px 20px",
  stripes: "repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 10px, transparent 10px 22px)",
  waves: "radial-gradient(circle at 100% 50%, transparent 20%, rgba(255,255,255,.18) 21%, rgba(255,255,255,.18) 34%, transparent 35%) 0 0/36px 24px",
  rings: "repeating-radial-gradient(circle at 80% 20%, rgba(255,255,255,.18) 0 4px, transparent 4px 18px)",
  stars: "radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.5px) 0 0/22px 22px, radial-gradient(rgba(255,255,255,.35) 1px, transparent 1.5px) 11px 11px/22px 22px",
  diamonds: "linear-gradient(135deg, rgba(255,255,255,.14) 25%, transparent 25%) 0 0/24px 24px, linear-gradient(225deg, rgba(255,255,255,.14) 25%, transparent 25%) 0 0/24px 24px",
};

export function coverBackground(color: string, pattern: string) {
  return `${PATTERNS[pattern] ?? PATTERNS.dots}, ${color}`;
}

export function EventCover({ color, pattern, height, className = "", label = "Event cover", children }: { color: string; pattern: string; height?: number; className?: string; label?: string; children?: React.ReactNode }) {
  const width = /(^|\s)w-/.test(className) ? "" : "w-full";
  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden ${width} ${className}`} style={{ height, background: coverBackground(color, pattern) }}>
      {children}
    </div>
  );
}
