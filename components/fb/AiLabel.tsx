import { Sparkles } from "lucide-react";
import { cn } from "./cn";

/** Plain-words AI label with a small icon. AI is labeled, never themed (DESIGN.md §1.8). */
export function AiLabel({ children = "Written by AI", className, testId }: { children?: React.ReactNode; className?: string; testId?: string }) {
  return (
    <span data-testid={testId} className={cn("inline-flex items-center gap-1 text-meta text-muted", className)}>
      <Sparkles size={12} aria-hidden />
      {children}
    </span>
  );
}
