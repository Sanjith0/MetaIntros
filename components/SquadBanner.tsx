import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AvatarStack } from "./Avatar";
import type { SquadSummary } from "@/lib/server/squads";

export function SquadBanner({ squad }: { squad: SquadSummary }) {
  return (
    <div data-testid="squad-banner" className="rounded-xl bg-gradient-to-r from-[#5b4bf5] to-[#9333ea] p-3 text-white shadow-md">
      <p className="flex items-center gap-1.5 font-bold">
        <Sparkles size={18} /> Your squad is going
      </p>
      <div className="mt-2 flex items-center justify-between">
        <AvatarStack people={squad.members} size={30} max={8} />
        {squad.chatId && (
          <Link href={`/chats/${squad.chatId}`} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#5b4bf5]">
            Open squad chat
          </Link>
        )}
      </div>
    </div>
  );
}
