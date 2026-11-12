"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Bottom sheet: scrim, white panel with 12px top corners, grabber, title. Slides up in 250ms.
 * Closes on scrim tap, Escape or the close button. role=dialog, focus moves in and is restored on close.
 */
export function Sheet({ open, onClose, title, children, testId, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; testId?: string; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-end">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade-in bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className={cn("relative max-h-[88dvh] animate-sheet-up overflow-y-auto rounded-t-sheet bg-surface pb-[max(env(safe-area-inset-bottom),12px)] shadow-elevated outline-none")}
      >
        <div className="sticky top-0 z-10 bg-surface pt-2">
          <span aria-hidden className="mx-auto block h-1 w-9 rounded-full bg-divider" />
          <div className="flex items-center justify-between px-4 pt-2 pb-2">
            <h2 id={titleId} className="text-headline font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="press inline-flex h-9 w-9 items-center justify-center rounded-full bg-control">
              <X size={20} />
            </button>
          </div>
        </div>
        {children}
        {footer && <div className="px-4 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
