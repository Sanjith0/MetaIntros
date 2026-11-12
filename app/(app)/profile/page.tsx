import { Avatar } from "@/components/Avatar";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { VOCAB_BY_TAG } from "@/lib/graph/vocabulary";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  const tp = await prisma.tasteProfile.findUnique({ where: { userId: me.id } });
  const tags = ((tp?.interestTags ?? []) as { tag: string }[]).slice(0, 10);
  return (
    <div data-testid="profile-page">
      <div className="h-28 bg-gradient-to-br from-fb-blue to-queue-glow" />
      <div className="-mt-12 bg-white px-4 pb-4">
        <Avatar name={me.name} color={me.avatarColor} size={96} ring className="ring-4" />
        <h1 className="mt-2 text-2xl font-bold">{me.name}</h1>
        <p className="text-fb-muted">{me.neighborhood ?? "Bay Area"} · {me.ageBand}</p>
      </div>
      <section className="mt-2 bg-white p-4">
        <h2 className="font-semibold">Interests</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t.tag} className="rounded-full bg-fb-bg px-3 py-1 text-sm">{VOCAB_BY_TAG.get(t.tag)?.label ?? t.tag}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
