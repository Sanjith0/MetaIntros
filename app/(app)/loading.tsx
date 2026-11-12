/** Shown while a tab's server data loads. (Also keeps Link prefetch from caching stale page data.) */
export default function Loading() {
  return (
    <div className="space-y-3 p-3" data-testid="loading" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="h-24 animate-pulse bg-[#e4e6eb]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#e4e6eb]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#e4e6eb]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[#e4e6eb]" />
          </div>
        </div>
      ))}
    </div>
  );
}
