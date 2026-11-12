import { cn } from "@/components/fb";

/** Feed photo layouts: 1 full width, 2 side by side, 3 = one wide + two, 4+ = 2×2 with "+N". */
export function PhotoGrid({ photos, alt }: { photos: { id: string; url: string }[]; alt: string }) {
  if (!photos.length) return null;
  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const img = (p: { id: string; url: string }, cls: string, i: number) => (
    <div key={p.id} className={cn("relative overflow-hidden bg-control", cls)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt={`${alt}, photo ${i + 1} of ${photos.length}`} loading="lazy" className="h-full w-full object-cover" data-testid="post-photo" />
      {extra > 0 && i === 3 && <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-page font-bold text-surface">+{extra}</span>}
    </div>
  );
  if (shown.length === 1) return <div className="max-h-[520px] overflow-hidden">{img(shown[0], "aspect-[4/3] w-full", 0)}</div>;
  if (shown.length === 2) return <div className="grid grid-cols-2 gap-0.5">{shown.map((p, i) => img(p, "aspect-square", i))}</div>;
  if (shown.length === 3)
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {img(shown[0], "col-span-2 aspect-[2/1]", 0)}
        {img(shown[1], "aspect-square", 1)}
        {img(shown[2], "aspect-square", 2)}
      </div>
    );
  return <div className="grid grid-cols-2 gap-0.5">{shown.map((p, i) => img(p, "aspect-square", i))}</div>;
}
