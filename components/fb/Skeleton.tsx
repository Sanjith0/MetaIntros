import { cn } from "./cn";

/** Grey placeholder block (static under reduced motion). */
export function Skeleton({ className, round = false }: { className?: string; round?: boolean }) {
  return <span aria-hidden className={cn("block animate-glimmer bg-control", round ? "rounded-full" : "rounded-card", className)} />;
}

/** A skeleton for an event card / feed unit. */
export function SkeletonCard() {
  return (
    <div className="bg-surface p-4" aria-hidden>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2" aria-hidden>
      <Skeleton round className="h-10 w-10" />
      <span className="flex-1">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </span>
    </div>
  );
}
