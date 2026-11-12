import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-fb-bg p-6 text-center" data-testid="not-found">
      <p className="text-[34px] font-bold tracking-tight text-fb-blue" style={{ letterSpacing: "-0.04em" }}>facebook</p>
      <p className="mt-4 text-lg font-bold">This content isn&apos;t available</p>
      <p className="mt-1 text-sm text-fb-muted">It may have expired (squad chats disappear 24h after the event) or you don&apos;t have access.</p>
      <Link href="/events" className="mt-4 rounded-lg bg-fb-blue px-4 py-2 font-semibold text-white">Go to Events</Link>
    </main>
  );
}
