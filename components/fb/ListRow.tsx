import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

type RowProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  unread?: boolean;
  bold?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  testId?: string;
  disabled?: boolean;
  /** extra attributes for tests */
  data?: Record<string, string | boolean | number | undefined>;
};

/** List row: leading avatar or icon circle, title, subtitle, trailing slot. Min 56px; pressed = wash. */
export function ListRow({ leading, title, subtitle, meta, trailing, unread, bold, href, onClick, className, testId, disabled, data }: RowProps) {
  const dataAttrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v === undefined ? undefined : String(v)]));
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-body", bold || unread ? "font-semibold" : "font-medium")}>{title}</span>
        {subtitle && <span className={cn("block text-meta", unread ? "font-semibold text-ink" : "text-muted")}>{subtitle}</span>}
        {meta && <span className="block text-meta text-muted">{meta}</span>}
      </span>
      {trailing}
    </>
  );
  const cls = cn(
    "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left",
    (href || onClick) && "transition-colors active:bg-wash hover:bg-press",
    unread && "bg-unread",
    disabled && "pointer-events-none opacity-60",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} data-testid={testId} {...dataAttrs}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} data-testid={testId} disabled={disabled} {...dataAttrs}>
        {body}
      </button>
    );
  return (
    <div className={cls} data-testid={testId} {...dataAttrs}>
      {body}
    </div>
  );
}

/** 36px (or custom) grey circle holding an icon: the leading slot for non-person rows. */
export function IconCircle({ children, size = 36, tone = "control", className }: { children: ReactNode; size?: number; tone?: "control" | "on" | "accent" | "positive"; className?: string }) {
  const tones = { control: "bg-control text-ink", on: "bg-on text-link", accent: "bg-accent text-surface", positive: "bg-positive text-surface" };
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full", tones[tone], className)} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}
