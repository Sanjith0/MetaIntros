const PATTERNS: Record<string, string> = {
  dots: "radial-gradient(rgba(255,255,255,.25) 2px, transparent 2.5px) 0 0/16px 16px",
  grid: "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px) 0 0/20px 20px",
  stripes: "repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 10px, transparent 10px 22px)",
  waves: "radial-gradient(circle at 100% 50%, transparent 20%, rgba(255,255,255,.18) 21%, rgba(255,255,255,.18) 34%, transparent 35%) 0 0/36px 24px",
  rings: "repeating-radial-gradient(circle at 80% 20%, rgba(255,255,255,.18) 0 4px, transparent 4px 18px)",
  stars: "radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.5px) 0 0/22px 22px, radial-gradient(rgba(255,255,255,.35) 1px, transparent 1.5px) 11px 11px/22px 22px",
  diamonds: "linear-gradient(135deg, rgba(255,255,255,.14) 25%, transparent 25%) 0 0/24px 24px, linear-gradient(225deg, rgba(255,255,255,.14) 25%, transparent 25%) 0 0/24px 24px",
};

export function EventCover({ color, pattern, height = 120, children }: { color: string; pattern: string; height?: number; children?: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, background: `${PATTERNS[pattern] ?? PATTERNS.dots}, linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {children}
    </div>
  );
}
