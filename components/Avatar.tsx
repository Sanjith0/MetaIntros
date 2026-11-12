/** First letter of up to two words. Code-point aware: "Roommates 🏠" → "R" (never half an emoji). */
export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
      .filter((c): c is string => Boolean(c))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({
  name,
  color = "#1877f2",
  photoUrl,
  size = 40,
  ring,
  className = "",
}: {
  name: string;
  color?: string;
  photoUrl?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${ring ? "ring-2 ring-white" : ""} ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 28,
  max = 6,
}: {
  people: { id: string; name: string; avatarColor: string; photoUrl?: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -size / 3 }}>
          <Avatar name={p.name} color={p.avatarColor} photoUrl={p.photoUrl} size={size} ring />
        </span>
      ))}
      {people.length > max && <span className="ml-1 text-xs text-fb-muted">+{people.length - max}</span>}
    </span>
  );
}
