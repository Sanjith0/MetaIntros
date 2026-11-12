"use client";

import { RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="m-3 rounded-xl bg-white p-6 text-center shadow-sm" data-testid="error-state">
      <p className="text-lg font-bold">Something went wrong</p>
      <p className="mt-1 text-sm text-fb-muted">Your squad is safe — this screen just failed to load.</p>
      <button type="button" onClick={reset} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-fb-blue px-4 py-2 font-semibold text-white">
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  );
}
