"use client";

import { useEffect } from "react";

/** Sets <html data-hydrated="1"> once React is interactive (E2E tests wait on it). */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return null;
}
