import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 text-center" data-testid="not-found">
      <div className="text-[44px] font-black text-[var(--color-ink-disabled)]">404</div>
      <h1 className="text-[20px] font-bold">This page isn't available</h1>
      <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">The link may be broken, or the page may have been removed.</p>
      <Link href="/events" className="press mt-4 inline-block rounded-[6px] bg-[var(--color-accent)] px-4 py-2 text-[15px] font-semibold text-white">
        Go to Events
      </Link>
    </main>
  );
}
