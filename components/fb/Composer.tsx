"use client";

import { SendHorizontal } from "lucide-react";

/** Messenger-style composer: pill input on wash ("Aa") + accent send. Enter sends. */
export function Composer({ value, onChange, onSend, disabled, placeholder = "Aa" }: { value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; placeholder?: string }) {
  return (
    <form
      className="flex items-center gap-2 border-t border-divider bg-surface px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label className="sr-only" htmlFor="composer">Message</label>
      <input
        id="composer"
        data-testid="composer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 min-w-0 flex-1 rounded-full bg-wash px-4 text-body outline-none placeholder:text-muted focus-visible:outline-2"
      />
      <button
        type="submit"
        data-testid="send"
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="press inline-flex h-9 w-9 items-center justify-center rounded-full text-accent disabled:text-disabled"
      >
        <SendHorizontal size={22} />
      </button>
    </form>
  );
}
