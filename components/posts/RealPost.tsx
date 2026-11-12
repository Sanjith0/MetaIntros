import { Post } from "@/components/feed/Post";
import { PhotoGrid } from "@/components/feed/PhotoGrid";
import type { PostView } from "@/lib/server/posts";
import { CaptionSource } from "./CaptionSource";
import { OwnPostMenu } from "./OwnPostMenu";

/** A real post on Home: own or a friend's. Photos come from the post-scoped photo route, never the album. */
export function RealPost({ post, ago }: { post: PostView; ago: string }) {
  const sample = !post.mine && post.author.isSimulated && !post.author.isLive;
  return (
    <Post
      id={`post-${post.id}`}
      testId="real-post"
      who={post.author.name}
      color={post.author.avatarColor}
      ago={sample ? `${ago} · Sample person` : ago}
      text={post.caption}
      audience={post.audience}
      place={post.event ? <>is at <span className="font-semibold">{post.event.title}</span> with their Queue Up squad.</> : undefined}
      label={post.aiSource ? <CaptionSource source={post.aiSource} edited={post.aiEdited} /> : undefined}
      menu={post.mine ? <OwnPostMenu postId={post.id} kind="post" /> : undefined}
    >
      <PhotoGrid photos={post.photos} alt={`${post.author.name}'s post`} />
    </Post>
  );
}
