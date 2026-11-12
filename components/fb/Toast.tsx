"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastItem { id: number; text: string; action?: { label: string; href: string } }
const Ctx = createContext<(text: string, action?: ToastItem["action"]) => void>(() => {});

/** Toast host: white, 8px radius, elevated, above the tab bar, 4s. role=status. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const n = useRef(0);
  const show = useCallback((text: string, action?: ToastItem["action"]) => {
    const id = ++n.current;
    setItems((xs) => [...xs.slice(-1), { id, text, action }]);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[72px] z-50 mx-auto flex max-w-md flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div data-testid="toast" className="pointer-events-auto flex w-full max-w-[328px] animate-fade-up items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 text-body shadow-elevated">
      <span>{item.text}</span>
      {item.action && (
        <Link href={item.action.href} className="shrink-0 font-semibold text-link" onClick={onDone}>
          {item.action.label}
        </Link>
      )}
    </div>
  );
}

export function useToast() {
  return useContext(Ctx);
}
