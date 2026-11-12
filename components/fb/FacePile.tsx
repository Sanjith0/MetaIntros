import { Avatar } from "./Avatar";
import { cn } from "./cn";

export interface Face {
  id: string;
  name: string;
  avatarColor: string;
  photoUrl?: string | null;
}

/** Overlapping avatars with a white ring; "+N" when there are more than `max`. */
export function FacePile({ people, size = 32, max = 6, blurred = false, className, testId }: { people: Face[]; size?: number; max?: number; blurred?: boolean; className?: string; testId?: string }) {
  const shown = people.slice(0, max);
  return (
    <span data-testid={testId} className={cn("inline-flex items-center", className)}>
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -Math.round(size / 4), zIndex: shown.length - i }} className="relative">
          <Avatar name={p.name} color={p.avatarColor} photoUrl={p.photoUrl} size={size} ring blurred={blurred} />
        </span>
      ))}
      {people.length > max && <span className="ml-1.5 text-meta text-muted">+{people.length - max}</span>}
    </span>
  );
}
