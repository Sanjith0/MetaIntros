import { Globe, Lock, MessageCircle, MoreHorizontal, Share2, ThumbsUp, Users } from "lucide-react";
import { Avatar } from "@/components/fb";

const AUDIENCE = {
  public: { Icon: Globe, label: "Public" },
  friends: { Icon: Users, label: "Friends" },
  only_me: { Icon: Lock, label: "Only me" },
};

/**
 * A feed post shell (template: feat's Post.tsx), rebuilt on tokens. Actions are inert in this prototype.
 * Seeded posts pass likes/comments; real posts (Link squads) pass an audience, an optional place
 * ("at <event> with their Link squad"), a label slot (AI captions) and a menu (own posts).
 */
export function Post({
  id,
  who,
  color,
  avatarUrl,
  ago,
  text,
  likes,
  comments,
  audience = "public",
  place,
  label,
  menu,
  testId = "post",
  children,
}: {
  id?: string;
  who: string;
  color: string;
  /** a Page's profile picture; people without one get their drawn avatar */
  avatarUrl?: string;
  ago: string;
  text: string;
  likes?: number;
  comments?: number;
  audience?: keyof typeof AUDIENCE;
  place?: React.ReactNode;
  label?: React.ReactNode;
  menu?: React.ReactNode;
  testId?: string;
  children?: React.ReactNode;
}) {
  const a = AUDIENCE[audience];
  return (
    <article id={id} className="scroll-mt-20 bg-surface" data-testid={testId}>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar name={who} color={color} photoUrl={avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          {place ? (
            <p className="text-body leading-snug"><span className="font-semibold">{who}</span> {place}</p>
          ) : (
            <p className="truncate text-body font-semibold">{who}</p>
          )}
          <p className="flex items-center gap-1 text-meta text-muted">{ago} · <a.Icon size={12} aria-label={a.label} /></p>
        </div>
        {menu ?? <MoreHorizontal size={20} className="text-muted" aria-hidden />}
      </div>
      {text && <p className="px-4 pt-2 pb-2 text-body whitespace-pre-line">{text}</p>}
      {label && <div className="px-4 pb-2">{label}</div>}
      {!text && !label && <div className="h-2" />}
      {children}
      {likes !== undefined && (
        <div className="flex items-center justify-between px-4 py-2 text-meta text-muted">
          <span className="flex items-center gap-1">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-surface" aria-hidden><ThumbsUp size={10} fill="currentColor" /></span>
            {likes}
          </span>
          <span>{comments ?? 0} comments</span>
        </div>
      )}
      <div className="mx-4 grid grid-cols-3 border-t border-divider/70 text-body font-semibold text-muted">
        {([[ThumbsUp, "Like"], [MessageCircle, "Comment"], [Share2, "Share"]] as const).map(([Icon, l]) => (
          <span key={l} className="flex items-center justify-center gap-1.5 py-2">
            <Icon size={18} aria-hidden /> {l}
          </span>
        ))}
      </div>
    </article>
  );
}
