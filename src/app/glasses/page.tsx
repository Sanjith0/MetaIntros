import { profileById } from "@/data/seed";
import { TabBar, TopBar } from "@/components/ui";

// P3 concept mock: what a crew-only live profile could look like through Meta glasses.
export default function Glasses() {
  const p = profileById("priya")!;
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar back="/menu" title="Glasses · P3 concept" />
      <main className="flex-1 p-3 space-y-3">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-b from-[#2b2440] via-[#3d2b4f] to-[#1a1424]">
          <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 30% 20%, #ffb86b55, transparent 40%), radial-gradient(circle at 75% 30%, #ff5c7a44, transparent 35%)" }} />
          <div className="absolute left-[38%] top-[30%] w-[30%] aspect-square rounded-[40%] border-2 border-[#7ef9c9] shadow-[0_0_20px_#7ef9c9]" />
          <div className="absolute left-[30%] top-[63%] right-[8%] rounded-xl bg-black/55 backdrop-blur text-white p-3 border border-white/20">
            <div className="text-[11px] text-[#7ef9c9] font-bold tracking-wider">● CREWMATE · ARRIVED</div>
            <div className="text-xl font-bold">{p.name}</div>
            <div className="text-sm text-white/80">Also at Cal Hacks 11 · mutual friend Sam Okafor</div>
            <div className="text-sm mt-1">Try: “Saltwater or riot?”</div>
          </div>
          <div className="absolute top-3 left-3 text-[10px] text-white/70 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Capture LED on</div>
        </div>
        <section className="bg-white rounded-xl p-4 text-[14px] space-y-1.5">
          <h2 className="font-bold">How it stays responsible</h2>
          <p>• Recognizes <b>only your accepted crew</b> (at most 7 people who opted in). Never strangers.</p>
          <p>• Face templates are enrolled on-device at accept time, shared only inside the crew, and deleted 2 hours after the event.</p>
          <p>• Bystanders&apos; faces are never processed past detection. No recording.</p>
          <p>• Any crewmate can tap “hide me” at any time.</p>
        </section>
      </main>
      <TabBar active="/menu" />
    </div>
  );
}
