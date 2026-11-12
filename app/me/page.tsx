import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { flag } from "@/lib/flags";
import { myData } from "@/lib/server/mydata";
import { currentViewerId } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Your data" };
export const dynamic = "force-dynamic";

export default async function MyDataPage() {
  if (!flag("MY_DATA")) notFound();
  const viewer = await currentViewerId();
  const d = myData(viewer);
  return (
    <main className="mx-auto max-w-[720px] space-y-4 px-4 py-5" data-testid="my-data">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-pq)]">Party Queue · Your data</div>
        <h1 className="text-[24px] font-bold">Everything we hold about you</h1>
        <p className="mt-1 text-[15px] text-[var(--color-ink-2)]">Only you see this page. It lists records that are yours, never anyone else&apos;s private data, and where to change each one.</p>
        <a href="/api/me/data" download data-testid="my-data-download" className="press mt-3 inline-flex rounded-[6px] bg-[var(--color-pq)] px-4 py-2 text-[15px] font-semibold text-white">
          Download as JSON
        </a>
      </div>
      {d.sections.map((s) => (
        <section key={s.id} className="rounded-[12px] bg-white p-4 shadow-[var(--shadow-card)]" data-testid={`data-${s.id}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-bold">{s.title}</h2>
            {s.manage && (
              <Link href={s.manage.href} className="shrink-0 text-[13px] font-semibold text-[var(--color-link)] hover:underline">
                {s.manage.label} →
              </Link>
            )}
          </div>
          {s.items.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px]">
              {s.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[14px] text-[var(--color-ink-2)]">Nothing.</p>
          )}
        </section>
      ))}
    </main>
  );
}
