"use client";

import type { ComponentProps } from "react";
import { cn } from "@/components/fb";

/** iOS-style switch on tokens (same look as the profile visibility toggle). */
export function Switch({ className, ...rest }: Omit<ComponentProps<"input">, "type" | "role">) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-control transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-surface before:shadow before:transition-transform checked:bg-accent checked:before:translate-x-[18px] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}
