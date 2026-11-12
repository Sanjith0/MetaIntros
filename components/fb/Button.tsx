import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "on" | "ghost" | "positive";
export type ButtonSize = "md" | "lg" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-surface hover:brightness-95",
  secondary: "bg-control text-ink hover:bg-control-hover",
  on: "bg-on text-link",
  ghost: "bg-transparent text-link hover:bg-press",
  positive: "bg-positive text-surface",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-meta",
  md: "h-9 px-3 text-body",
  lg: "h-11 px-4 text-title",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", block = false) {
  return cn(
    "press inline-flex items-center justify-center gap-1.5 rounded-btn font-semibold whitespace-nowrap",
    "disabled:cursor-not-allowed disabled:bg-control disabled:text-disabled aria-disabled:pointer-events-none aria-disabled:bg-control aria-disabled:text-disabled",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: ReactNode; children?: ReactNode };

export function Button({ variant, size, block, icon, children, className, type = "button", ...rest }: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={cn(buttonClass(variant, size, block), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, block, icon, children, className, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(buttonClass(variant, size, block), className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** 36px round grey icon button (top bar actions, "…"). */
export function IconButton({ label, children, className, href, badge, ...rest }: { label: string; href?: string; badge?: ReactNode } & ComponentProps<"button">) {
  const cls = cn("press relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-control text-ink hover:bg-control-hover", className);
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls} data-testid={rest["data-testid" as keyof typeof rest] as string | undefined}>
        {children}
        {badge}
      </Link>
    );
  return (
    <button type="button" aria-label={label} className={cls} {...rest}>
      {children}
      {badge}
    </button>
  );
}
