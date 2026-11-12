export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Load the global clock before the first request (DB timestamp defaults read it synchronously).
    const { loadClock } = await import("./lib/server/clock");
    await loadClock().catch(() => {});
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NETWORK_DISABLED === "1") {
    const { installNetGuard } = await import("./lib/netguard");
    installNetGuard();
    console.log("[netguard] outbound network disabled");
  }
}
