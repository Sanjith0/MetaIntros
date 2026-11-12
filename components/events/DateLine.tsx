import { fmtEventWhen } from "@/lib/format";
import { cn } from "@/components/fb";

/** The red event date line: the only capitals in the app (DESIGN.md §1.3). */
export function DateLine({ start, end, className, testId }: { start: Date; end?: Date; className?: string; testId?: string }) {
  return (
    <p data-testid={testId} className={cn("text-meta font-semibold text-date uppercase", className)}>
      {fmtEventWhen(start, end).replace(" · ", " at ")}
    </p>
  );
}
