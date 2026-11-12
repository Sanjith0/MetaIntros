"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";

export function ArchivedPrompt({ partyId }: { partyId: string }) {
  return (
    <Link href={`/squad/${partyId}/connect`} data-testid="stay-in-touch"
      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1877f2] to-[#9333ea] p-3 font-bold text-white shadow">
      <UserPlus size={18} /> Want to stay in touch? Add your squad as friends.
    </Link>
  );
}
