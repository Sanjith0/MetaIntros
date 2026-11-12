export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NETWORK_DISABLED === "1") {
    const { installNetGuard } = await import("./lib/netguard");
    installNetGuard();
    console.log("[netguard] outbound network disabled");
  }
}
