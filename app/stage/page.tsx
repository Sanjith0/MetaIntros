import type { Metadata } from "next";
import { StageBoard } from "@/components/stage/StageBoard";
import { StageReplay } from "@/components/stage/StageReplay";
import { flag } from "@/lib/flags";
import { stageView } from "@/lib/server/views";

export const metadata: Metadata = { title: "Stage" };
export const dynamic = "force-dynamic";

export default async function StagePage({ searchParams }: { searchParams: Promise<{ party?: string }> }) {
  const { party } = await searchParams;
  const view = stageView(party);
  return flag("STAGE_SCRUBBER") ? <StageReplay initial={view} leakTest={flag("LEAK_TEST")} /> : <StageBoard initial={view} />;
}
