import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { Avatar } from "./Avatar";

export function Header({ me }: { me: { name: string; avatarColor: string } }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-4 py-2 shadow-sm">
      <Link href="/home" className="text-[28px] font-bold tracking-tight text-fb-blue" style={{ letterSpacing: "-0.04em" }}>
        facebook
      </Link>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fb-bg">
          <Search size={18} />
        </span>
        <Link href="/chats" className="flex h-9 w-9 items-center justify-center rounded-full bg-fb-bg" aria-label="Messenger">
          <MessageCircle size={18} />
        </Link>
        <Link href="/profile" data-testid="header-avatar" aria-label="Your profile">
          <Avatar name={me.name} color={me.avatarColor} size={36} />
        </Link>
      </div>
    </header>
  );
}
