"use client";

import Link from "next/link";

/** Something broke while rendering a page. The demo data is in memory, so a retry usually works. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 text-center" role="alert" data-testid="error-page">
      <h1 className="text-[20px] font-bold">Something went wrong</h1>
      <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">Nothing you typed was shared. Try again, or head back to Events.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={reset} className="press rounded-[6px] bg-[var(--color-accent)] px-4 py-2 text-[15px] font-semibold text-white">
          Try again
        </button>
        <Link href="/events" className="press rounded-[6px] bg-[var(--color-btn-2)] px-4 py-2 text-[15px] font-semibold">
          Events
        </Link>
      </div>
    </main>
  );
}
