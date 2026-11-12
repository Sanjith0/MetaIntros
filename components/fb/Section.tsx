import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Full-width white block on the wash. Sections stack with 8px of wash between them (use <Stack>). */
export function Section({
  title,
  seeAll,
  action,
  children,
  className,
  flush = false,
  testId,
}: {
  title?: ReactNode;
  seeAll?: { href: string; label?: string };
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** no inner horizontal padding (lists that run edge to edge) */
  flush?: boolean;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={cn("bg-surface py-3", !flush && "px-4", className)}>
      {(title || seeAll || action) && (
        <div className={cn("mb-2 flex items-center justify-between gap-3", flush && "px-4")}>
          {title && <h2 className="text-title font-semibold">{title}</h2>}
          {seeAll && (
            <Link href={seeAll.href} className="text-body text-link">
              {seeAll.label ?? "See all"}
            </Link>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Vertical stack of Sections with 8px of wash between them. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

/** Inner card on a white section (e.g. an event attachment). */
export function Card({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div data-testid={testId} className={cn("overflow-hidden rounded-card bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-divider", className)} />;
}
