import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { StageBoard } from "@/components/stage/StageBoard";
import { StageReplay } from "@/components/stage/StageReplay";
import { flag } from "@/lib/flags";
import { lanAddress } from "@/lib/server/phones";
import { publicStageView, stageView } from "@/lib/server/views";

export const metadata: Metadata = { title: "Stage" };
export const dynamic = "force-dynamic";

/** F46: the room's view, for phones that scan the QR. Enforced on the server: it only ever gets sanitized data. */
async function followQr(): Promise<{ url: string; svg: string } | null> {
  if (!flag("FOLLOW_ALONG")) return null;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":").pop() : "80";
  const lan = lanAddress();
  const url = `${lan ? `http://${lan}:${port}` : `http://${host}`}/stage?screen=room`;
  return { url, svg: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0c0d12", light: "#ffffff" } }) };
}

export default async function StagePage({ searchParams }: { searchParams: Promise<{ party?: string; screen?: string; big?: string }> }) {
  const { party, screen, big } = await searchParams;
  const room = screen === "room" && flag("FOLLOW_ALONG");
  const view = room ? publicStageView(party) : stageView(party);
  if (!flag("STAGE_SCRUBBER")) return <StageBoard initial={view} />;
  return (
    <StageReplay
      initial={view}
      leakTest={flag("LEAK_TEST") && !room}
      whatIf={flag("WHAT_IF") && !room}
      pinned={party && flag("STAGE_PARTIES") ? party : null}
      captions={flag("STAGE_CAPTIONS")}
      publicScreen={flag("PUBLIC_SCREEN")}
      publicAtLoad={screen === "public"}
      locked={room}
      follow={await followQr()}
      keys={flag("STAGE_KEYS") && !room}
      splash={flag("LOCK_SPLASH")}
      bigText={flag("STAGE_BIG")}
      bigAtLoad={big === "1"}
    />
  );
}
