import { Character } from "./Character";
import { cn } from "./cn";

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

/**
 * A person's circle: their photo, or their drawn character. `character={false}` is for things (a squad chat,
 * Link itself): initials on the colour. `blurred` hides who it is until the squad is confirmed, so it
 * draws a stand-in that carries nothing of the person.
 */
export function Avatar({
  name,
  color,
  photoUrl,
  size = 40,
  ring = false,
  blurred = false,
  dim = false,
  character = true,
  className,
}: {
  name: string;
  color?: string;
  photoUrl?: string | null;
  size?: number;
  ring?: boolean;
  blurred?: boolean;
  dim?: boolean;
  /** draw a character (people); false = initials (things) */
  character?: boolean;
  className?: string;
}) {
  const drawn = character && !(photoUrl && !blurred);
  return (
    <span
      role="img"
      aria-label={blurred ? "Hidden until your squad is confirmed" : name}
      title={blurred ? undefined : name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-control align-middle font-semibold text-surface select-none",
        ring && "ring-2 ring-surface",
        dim && "opacity-50 grayscale",
        className,
      )}
      style={{ width: size, height: size, background: drawn ? undefined : color, fontSize: Math.round(size * 0.38) }}
    >
      {photoUrl && !blurred ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : drawn ? (
        <span aria-hidden className={cn("block h-full w-full", blurred && "blur-[3px]")}>
          <Character seed={blurred ? "hidden" : name} color={blurred || !color ? "var(--color-muted)" : color} />
        </span>
      ) : (
        <span aria-hidden className={blurred ? "blur-[5px]" : undefined}>{initials(name)}</span>
      )}
    </span>
  );
}
