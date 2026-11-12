import { AiLabel } from "@/components/fb";
import { describeSource } from "@/lib/ai/status";

/**
 * Who wrote a posted caption, for the feed. Same honesty rules as AiSourceLabel (describeSource), worded
 * for a post that may be days old (so no "just now"); "edited" when the author changed the AI draft.
 */
export function CaptionSource({ source, edited, className }: { source: string | null; edited?: boolean; className?: string }) {
  const d = describeSource(source);
  if (!d) return null;
  const words = d.ai ? "Caption written by AI" : source === "mock" ? "Caption by the test model" : "Caption from a template (AI unavailable)";
  return (
    <span title={d.detail} data-testid="caption-source" data-source={source} className="inline-flex">
      <AiLabel className={className}>{edited ? `${words}, edited by the author` : words}</AiLabel>
    </span>
  );
}
