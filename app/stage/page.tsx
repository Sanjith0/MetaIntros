import type { Metadata } from "next";
import { StageBoard } from "@/components/stage/StageBoard";
import { StageReplay } from "@/components/stage/StageReplay";
import { flag } from "@/lib/flags";
import { stageView } from "@/lib/server/views";

export const metadata: Metadata = { title: "Stage" };
export const dynamic = "force-dynamic";

export default async function StagePage({ searchParams }: { searchParams: Promise<{ party?: string; screen?: string }> }) {
  const { party, screen } = await searchParams;
  const view = stageView(party);
  return flag("STAGE_SCRUBBER") ? <StageReplay initial={view} leakTest={flag("LEAK_TEST")} whatIf={flag("WHAT_IF")} pinned={party && flag("STAGE_PARTIES") ? party : null} captions={flag("STAGE_CAPTIONS")} publicScreen={flag("PUBLIC_SCREEN")} publicAtLoad={screen === "public"} /> : <StageBoard initial={view} />;
}
