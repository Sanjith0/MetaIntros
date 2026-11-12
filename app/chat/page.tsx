import { redirect } from "next/navigation";
import { chatsFor } from "@/lib/server/social";
import { currentViewerId } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export default async function ChatIndex() {
  const viewer = await currentViewerId();
  const first = chatsFor(viewer)[0];
  if (first) redirect(`/chat/${first.chat.id}`);
  return (
    <main className="mx-auto max-w-[480px] p-8 text-center text-[var(--color-ink-2)]">
      No chats yet. Find a party from any event and your group chat will show up here.
    </main>
  );
}
