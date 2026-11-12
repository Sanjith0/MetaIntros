import { Globe, MessageCircle, MoreHorizontal, Share2, ThumbsUp, X } from "lucide-react";
import { Avatar } from "@/components/ui";

export function Post({ author, hue, meta, text, children, likes, comments }: { author: string; hue: number; meta: string; text?: string; children?: React.ReactNode; likes: number; comments: number }) {
  const [first, last] = author.split(" ");
  return (
    <article className="bg-white mt-2">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Avatar p={{ name: first, lastName: last, hue }} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px] leading-tight truncate">{author}</div>
          <div className="text-[13px] text-sub flex items-center gap-1">
            {meta} · <Globe size={12} />
          </div>
        </div>
        <MoreHorizontal size={20} className="text-sub" />
        <X size={20} className="text-sub" />
      </div>
      {text && <p className="px-3 pt-2 text-[15px] leading-snug">{text}</p>}
      <div className="mt-2">{children}</div>
      <div className="px-3 py-2 flex items-center justify-between text-[13px] text-sub">
        <span className="flex items-center gap-1">
          <span className="w-[18px] h-[18px] rounded-full bg-fb grid place-items-center"><ThumbsUp size={10} color="#fff" fill="#fff" /></span>
          {likes}
        </span>
        <span>{comments} comments</span>
      </div>
      <div className="mx-3 border-t border-line/50 grid grid-cols-3 text-sub text-[14px] font-semibold">
        {[
          [ThumbsUp, "Like"],
          [MessageCircle, "Comment"],
          [Share2, "Share"],
        ].map(([Icon, l]) => {
          const I = Icon as typeof ThumbsUp;
          return (
            <button key={l as string} className="py-2 flex items-center justify-center gap-1.5">
              <I size={18} /> {l as string}
            </button>
          );
        })}
      </div>
    </article>
  );
}
