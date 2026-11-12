import { cn } from "./cn";

/** Red count badge (top-right of an icon), or a blue unread dot. */
export function Badge({ count, dot = false, tone = "red", className, testId }: { count?: number; dot?: boolean; tone?: "red" | "blue"; className?: string; testId?: string }) {
  if (dot) return <span data-testid={testId} aria-label="Unread" className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent", className)} />;
  if (!count || count <= 0) return null;
  return (
    <span
      data-testid={testId}
      aria-label={`${count} new`}
      className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] leading-none font-bold text-surface", tone === "red" ? "bg-badge ring-2 ring-surface" : "bg-accent", className)}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
