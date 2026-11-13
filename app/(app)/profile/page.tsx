import { Briefcase, Cake, Home, MapPin, Pencil, Users } from "lucide-react";
import { personaFrom } from "@/lib/profile/persona";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, Button, ListRow, IconCircle, Section, Stack } from "@/components/fb";
import { DeleteMe } from "@/components/profile/DeleteMe";
import { QueueVisibilityToggle } from "@/components/profile/QueueVisibilityToggle";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { VOCAB_BY_TAG } from "@/lib/graph/vocabulary";
import { BriefCard } from "@/components/companion/BriefCard";
import { getBriefFor } from "@/lib/server/briefs";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  const [tp, friends, squads] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { userId: me.id } }),
    prisma.friendship.count({ where: { OR: [{ userAId: me.id }, { userBId: me.id }] } }),
    prisma.partyMember.count({ where: { userId: me.id, party: { status: { in: ["confirmed", "completed"] } } } }),
  ]);
  const persona = personaFrom(me.rawGraph);
  const tags = ((tp?.interestTags ?? []) as { tag: string }[]).slice(0, 10);
  const brief = await getBriefFor(me.id, { mode: "events", eventTitle: null, targetSize: 6 }, false);
  return (
    <div data-testid="profile-page">
      <TopBar title="Profile" />
      <Stack>
        <section className="bg-surface pb-4">
          <div className="h-28 bg-control" aria-hidden />
          <div className="-mt-12 px-4">
            <Avatar name={me.name} color={me.avatarColor} size={104} ring className="ring-4" />
            <h1 className="mt-2 text-page font-bold" data-testid="header-avatar-name">{me.name}</h1>
            <p className="text-body text-muted">{friends} friends</p>
            {persona.about && <p className="mt-2 text-body" data-testid="profile-about">{persona.about}</p>}
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" icon={<Pencil size={16} />}>Edit profile</Button>
            </div>
          </div>
        </section>
        <Section title="Details" flush>
          {persona.work && <ListRow leading={<IconCircle><Briefcase size={18} /></IconCircle>} title={persona.work} />}
          <ListRow leading={<IconCircle><MapPin size={18} /></IconCircle>} title={`Lives in ${me.neighborhood ?? "the Bay Area"}`} />
          {persona.hometown && <ListRow leading={<IconCircle><Home size={18} /></IconCircle>} title={`From ${persona.hometown}`} />}
          <ListRow leading={<IconCircle><Cake size={18} /></IconCircle>} title={`Age ${me.ageBand}`} />
          <ListRow leading={<IconCircle><Users size={18} /></IconCircle>} title={`${squads} Queue Up squad${squads === 1 ? "" : "s"}`} href="/friends?tab=queueup" />
        </Section>
        <Section title="Queue Up privacy" flush>
          <QueueVisibilityToggle initial={me.queueVisibility === "friends"} />
        </Section>
        {brief && <BriefCard initial={brief.facts.map(({ id, kind, text, share }) => ({ id, kind, text, share }))} communication={brief.communication} />}
        <Section title="Interests">
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.tag} className="rounded-full bg-control px-3 py-1 text-body">{VOCAB_BY_TAG.get(t.tag)?.label ?? t.tag}</li>
            ))}
          </ul>
        </Section>
        {me.isLive && (
          <Section title="Your demo data" className="pb-4">
            <p className="mb-3 text-meta text-muted">You signed up on this phone. Your data is deleted 24 hours after sign-up, or now if you prefer.</p>
            <DeleteMe />
          </Section>
        )}
      </Stack>
    </div>
  );
}
