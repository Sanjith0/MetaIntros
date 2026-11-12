"use client";
import { useCallback, useEffect, useState } from "react";
import type { CrewView } from "@/lib/types";

export function useCrew(id: string, pollMs = 700) {
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [missing, setMissing] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/crew/${id}`);
    if (r.status === 404) return setMissing(true);
    setCrew(await r.json());
  }, [id]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);
  return { crew, setCrew, missing, refresh };
}
