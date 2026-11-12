import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function chipClass(on: boolean, className?: string) {
  return cn(
    "press inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-body font-semibold whitespace-nowrap",
    on ? "bg-on text-link" : "bg-control text-ink hover:bg-control-hover",
    className,
  );
}

/** Filter chip that navigates (role=tab inside a ChipRow). */
export function ChipLink({ on, children, className, ...rest }: { on: boolean; children: ReactNode } & ComponentProps<typeof Link>) {
  return (
    <Link role="tab" aria-selected={on} className={chipClass(on, className)} {...rest}>
      {children}
    </Link>
  );
}

/** Toggle chip. */
export function Chip({ on, children, className, ...rest }: { on: boolean; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button type="button" aria-pressed={on} className={chipClass(on, className)} {...rest}>
      {children}
    </button>
  );
}

export function ChipRow({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4", className)}>
      {children}
    </div>
  );
}
