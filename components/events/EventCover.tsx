/*
 * Event covers are content. Seeded events have a photo (lib/images.ts); the rest stand in with the event's colour and pattern.
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

/** A cover: the event's photo when it has one (lib/images.ts), over its colour while it loads; else colour + pattern. */
export function EventCover({ color, pattern, src, height, className = "", label = "Event cover", eager = false, children }: { color: string; pattern: string; src?: string | null; height?: number; className?: string; label?: string; /** above the fold (an event page's hero): don't lazy-load */ eager?: boolean; children?: React.ReactNode }) {
  const width = /(^|\s)w-/.test(className) ? "" : "w-full";
  return (
    // Seeded photos are AI-generated stand-ins (scripts/gen-images.ts), and their name says so.
    <div role="img" aria-label={src ? `${label} (AI image)` : label} className={`relative overflow-hidden ${width} ${className}`} style={{ height, background: src ? color : coverBackground(color, pattern) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" data-testid="cover-photo" />}
      {children}
    </div>
  );
}
