import type { Metadata } from "next";
import { StageBoard } from "@/components/stage/StageBoard";
import { stageView } from "@/lib/server/views";

export const metadata: Metadata = { title: "Stage" };
export const dynamic = "force-dynamic";

export default async function StagePage({ searchParams }: { searchParams: Promise<{ party?: string }> }) {
  const { party } = await searchParams;
  return <StageBoard initial={stageView(party)} />;
}
