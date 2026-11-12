import { SkeletonCard, SkeletonRow } from "@/components/fb";

/** Shown while a tab's server data loads. (Also keeps Link prefetch from caching stale page data.) */
export default function Loading() {
  return (
    <div data-testid="loading" aria-busy="true" className="flex flex-col gap-2">
      <div className="h-[76px] bg-surface" />
      <div className="bg-surface py-2">
        <SkeletonRow />
        <SkeletonRow />
      </div>
      <SkeletonCard />
    </div>
  );
}
