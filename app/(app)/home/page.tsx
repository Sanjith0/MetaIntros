import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/server/session";

const POSTS = [
  { who: "Peninsula Boulders", color: "#ea580c", text: "New problems set on the cave wall this week 🧗 Come try the purple V3!", ago: "2h" },
  { who: "Palo Alto Runners", color: "#f59e0b", text: "Saturday 5K is ON. Meet at the Oval at 8. Coffee after ☕️", ago: "5h" },
  { who: "Bay Area Indie Shows", color: "#7c3aed", text: "Who's going to Indie Night at The Guild this weekend?", ago: "1d" },
];

export default async function HomePage() {
  const me = await getCurrentUser();
  return (
    <div className="space-y-2" data-testid="home-page">
      <div className="flex items-center gap-2 bg-white p-3">
        <Avatar name={me.name} color={me.avatarColor} size={40} />
        <div className="flex-1 rounded-full border border-fb-divider px-4 py-2 text-fb-muted">What&apos;s on your mind?</div>
      </div>
      <Link href="/events" className="block bg-gradient-to-r from-fb-blue to-queue-glow p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">New in Events</p>
        <p className="text-lg font-bold">Queue Up — go with a squad, not alone</p>
      </Link>
      {POSTS.map((p) => (
        <article key={p.who} className="bg-white p-3">
          <div className="flex items-center gap-2">
            <Avatar name={p.who} color={p.color} size={40} />
            <div>
              <p className="font-semibold">{p.who}</p>
              <p className="text-xs text-fb-muted">{p.ago}</p>
            </div>
          </div>
          <p className="mt-2">{p.text}</p>
        </article>
      ))}
    </div>
  );
}
