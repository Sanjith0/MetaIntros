"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";

export interface SwitcherPerson {
  id: string;
  name: string;
  hue: number;
}

/** Demo user switcher. This replaces login: there is no login anywhere. */
export function UserSwitcher({ viewer, demo, others }: { viewer: SwitcherPerson; demo: SwitcherPerson[]; others: SwitcherPerson[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const choose = (id: string) => {
    setOpen(false);
    start(async () => {
      await fetch("/api/viewer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        data-testid="user-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`press flex items-center gap-2 rounded-full bg-[var(--color-btn-2)] py-1 pl-1 pr-3 hover:bg-[var(--color-btn-2-hover)] ${pending ? "opacity-60" : ""}`}
      >
        <Avatar name={viewer.name} hue={viewer.hue} size={28} />
        <span className="hidden text-[15px] font-semibold sm:inline">{viewer.name.split(" ")[0]}</span>
        <span className="text-[11px] text-[var(--color-ink-2)]">▾</span>
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-11 z-50 max-h-[70vh] w-[280px] overflow-y-auto rounded-[8px] bg-white p-2 shadow-[var(--shadow-elevated)]">
          <div className="px-2 pb-1 pt-1 text-[13px] font-semibold text-[var(--color-ink-2)]">Demo user: view the app as</div>
          {[...demo, ...others].map((p, i) => (
            <div key={p.id}>
              {i === demo.length && <div className="my-1 border-t border-[var(--color-divider)]" />}
              <button
                role="option"
                aria-selected={p.id === viewer.id}
                data-testid={`switch-${p.id}`}
                onClick={() => choose(p.id)}
                className={`flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-black/5 ${p.id === viewer.id ? "bg-[var(--color-on-bg)]" : ""}`}
              >
                <Avatar name={p.name} hue={p.hue} size={32} />
                <span className="text-[15px] font-medium">{p.name}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
