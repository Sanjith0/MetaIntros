import { Play } from "lucide-react";
import { TopBar } from "@/components/fb/TopBar";
import { Avatar, ChipLink, ChipRow, Stack } from "@/components/fb";
import { EventCover } from "@/components/events/EventCover";
import { VIDEOS } from "@/lib/mock/feed";

/** Seeded mock of the Video tab: outside the Queue Up hero path, but it doesn't dead-end. */
export default function VideoPage() {
  return (
    <div data-testid="video-page">
      <TopBar title="Video" />
      <Stack>
        <div className="bg-surface px-4 pt-1 pb-3">
          <ChipRow label="Video sections">
            <ChipLink href="/video" on>For you</ChipLink>
            <ChipLink href="/video" on={false}>Live</ChipLink>
            <ChipLink href="/video" on={false}>Following</ChipLink>
          </ChipRow>
        </div>
        {VIDEOS.map((v) => (
          <article key={v.id} className="bg-surface pb-3">
            <div className="flex items-center gap-2 px-4 py-3">
              <Avatar name={v.page} color={v.color} size={40} />
              <div>
                <p className="text-body font-semibold">{v.page}</p>
                <p className="text-meta text-muted">{v.ago}</p>
              </div>
            </div>
            <p className="px-4 pb-2 text-body">{v.title}</p>
            <EventCover color={v.color} pattern={v.pattern} className="aspect-video">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-scrim text-surface" aria-label="Play (off in this prototype)">
                  <Play size={26} fill="currentColor" />
                </span>
              </span>
            </EventCover>
            <p className="px-4 pt-2 text-meta text-muted">{v.views}</p>
          </article>
        ))}
      </Stack>
    </div>
  );
}
