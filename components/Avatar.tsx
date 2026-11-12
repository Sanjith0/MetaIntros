/** Up to two initials from words that start with a letter ("Robin (fair guest)" -> "R"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase() || "?";
}

/** Coloured initials. No photos anywhere in the app. */
export function Avatar({
  name,
  hue,
  size = 36,
  ring = false,
  className = "",
}: {
  name: string;
  hue: number;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-white" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        background: `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 28) % 360} 58% 42%))`,
      }}
    >
      {initials}
    </span>
  );
}

export function FacePile({ people, size = 32, max = 6 }: { people: { name: string; hue: number; id: string }[]; size?: number; max?: number }) {
  return (
    <span className="flex">
      {people.slice(0, max).map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -size / 4 }}>
          <Avatar name={p.name} hue={p.hue} size={size} ring />
        </span>
      ))}
    </span>
  );
}
