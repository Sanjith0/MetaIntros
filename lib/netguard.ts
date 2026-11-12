/**
 * NETWORK_DISABLED=1 simulates "Wi-Fi died": any server-side fetch to a non-local host fails
 * immediately. Used by E2E to prove the demo runs fully offline.
 */
const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function installNetGuard() {
  const g = globalThis as unknown as { __quNetGuard?: boolean; fetch: typeof fetch };
  if (g.__quNetGuard) return;
  g.__quNetGuard = true;
  const real = g.fetch.bind(globalThis);
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!LOCAL.has(url.hostname)) throw new Error(`network disabled (blocked ${url.hostname})`);
    return real(input, init);
  }) as typeof fetch;
}
