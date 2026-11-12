"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { Avatar } from "@/components/fb";
import { Sheet } from "@/components/fb/Sheet";
import { useToast } from "@/components/fb/Toast";
import { EventCover } from "@/components/events/EventCover";
import { PostComposer, type ComposerAlbum } from "./PostComposer";
import { StoryViewer, type StoryGroupItem } from "./StoryViewer";

interface MockStory { id: string; name: string; color: string; pattern: string }

/**
 * Top of Home: "What's on your mind?" and the stories rail. Both open one composer (text, or photos
 * from your own squad albums). Real stories (yours first, then friends') lead the rail and open a
 * full-screen viewer; the seeded sample stories after them stay inert.
 */
export function HomeTop({ me, stories, mockStories, albums }: { me: { name: string; avatarColor: string }; stories: StoryGroupItem[]; mockStories: MockStory[]; albums: ComposerAlbum[] }) {
  const router = useRouter();
  const toast = useToast();
  const [compose, setCompose] = useState<null | "post" | "story">(null);
  const [opens, setOpens] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const open = (k: "post" | "story") => {
    setOpens((n) => n + 1);
    setCompose(k);
  };
  const tileOf = (g: StoryGroupItem) => {
    const latest = g.stories[g.stories.length - 1];
    return latest.photos[0] ?? g.stories.flatMap((s) => s.photos)[0] ?? null;
  };

  return (
    <>
      <div className="flex items-center gap-2 bg-surface px-4 py-2">
        <Avatar name={me.name} color={me.avatarColor} size={40} />
        <button type="button" onClick={() => open("post")} className="flex h-10 flex-1 items-center rounded-full border border-divider px-4 text-left text-body text-muted hover:bg-press" data-testid="home-compose">
          What&apos;s on your mind?
        </button>
        <button type="button" onClick={() => open("post")} aria-label="Photo" className="press inline-flex h-10 w-10 items-center justify-center rounded-full text-positive hover:bg-press">
          <ImageIcon size={24} />
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto bg-surface px-4 py-3" data-testid="stories-rail">
        <button type="button" onClick={() => open("story")} className="press flex h-44 w-24 shrink-0 flex-col overflow-hidden rounded-card border border-divider/70 text-left" data-testid="create-story">
          <span className="flex w-full flex-1 items-center justify-center bg-wash"><Avatar name={me.name} color={me.avatarColor} size={48} /></span>
          <span className="relative block h-12 w-full pt-5 text-center text-meta font-semibold">
            <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-surface ring-4 ring-surface"><Plus size={16} strokeWidth={3} /></span>
            Create story
          </span>
        </button>
        {stories.map((g, i) => {
          const photo = tileOf(g);
          return (
            <button
              key={g.author.id}
              type="button"
              onClick={() => setViewing(i)}
              className="press relative h-44 w-24 shrink-0 overflow-hidden rounded-card bg-ink text-left"
              aria-label={`${g.mine ? "Your" : `${g.author.name}'s`} story`}
              data-testid="story-tile"
              data-author={g.author.id}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-meta font-semibold text-surface">{g.stories[g.stories.length - 1].caption.slice(0, 60)}</span>
              )}
              <span className="absolute top-2 left-2"><Avatar name={g.author.name} color={g.author.avatarColor} size={32} className="ring-2 ring-accent" /></span>
              <span className="absolute inset-x-0 bottom-0 bg-ink/50 px-2 py-1.5 text-meta leading-tight font-semibold text-surface">{g.mine ? "Your story" : g.author.name}</span>
            </button>
          );
        })}
        {mockStories.map((s) => (
          <EventCover key={s.id} color={s.color} pattern={s.pattern} label={`${s.name}'s story`} className="h-44 w-24 shrink-0 rounded-card">
            <span className="absolute top-2 left-2"><Avatar name={s.name} color={s.color} size={32} className="ring-2 ring-accent" /></span>
            <span className="absolute right-2 bottom-2 left-2 text-meta leading-tight font-semibold text-surface">{s.name}</span>
          </EventCover>
        ))}
      </div>

      <Sheet open={compose !== null} onClose={() => setCompose(null)} title={compose === "story" ? "Create story" : "Create post"} testId="home-composer-sheet">
        <div className="px-4 pb-2">
          {compose && (
            <PostComposer
              key={opens}
              albums={albums}
              initialKind={compose}
              onPosted={(r) => {
                setCompose(null);
                toast(r.kind === "story" ? "Added to your story" : "Posted");
                router.refresh();
              }}
            />
          )}
        </div>
      </Sheet>

      {viewing !== null && <StoryViewer groups={stories} startGroup={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
