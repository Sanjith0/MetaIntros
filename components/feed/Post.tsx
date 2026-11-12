import { Globe, MessageCircle, MoreHorizontal, Share2, ThumbsUp } from "lucide-react";
import { Avatar } from "@/components/fb";

/** A feed post shell (template: feat's Post.tsx), rebuilt on tokens. Actions are inert in this prototype. */
export function Post({ who, color, ago, text, likes, comments, children }: { who: string; color: string; ago: string; text: string; likes: number; comments: number; children?: React.ReactNode }) {
  return (
    <article className="bg-surface" data-testid="post">
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar name={who} color={color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{who}</p>
          <p className="flex items-center gap-1 text-meta text-muted">{ago} · <Globe size={12} aria-label="Public" /></p>
        </div>
        <MoreHorizontal size={20} className="text-muted" aria-hidden />
      </div>
      <p className="px-4 pt-2 pb-2 text-body">{text}</p>
      {children}
      <div className="flex items-center justify-between px-4 py-2 text-meta text-muted">
        <span className="flex items-center gap-1">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-surface" aria-hidden><ThumbsUp size={10} fill="currentColor" /></span>
          {likes}
        </span>
        <span>{comments} comments</span>
      </div>
      <div className="mx-4 grid grid-cols-3 border-t border-divider/70 text-body font-semibold text-muted">
        {([[ThumbsUp, "Like"], [MessageCircle, "Comment"], [Share2, "Share"]] as const).map(([Icon, label]) => (
          <span key={label} className="flex items-center justify-center gap-1.5 py-2">
            <Icon size={18} aria-hidden /> {label}
          </span>
        ))}
      </div>
    </article>
  );
}
