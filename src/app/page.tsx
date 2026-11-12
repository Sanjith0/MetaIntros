import Link from "next/link";
import { Image as ImageIcon, Plus } from "lucide-react";
import { EVENTS, ME, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { Avatar, TabBar, TopBar } from "@/components/ui";
import { Post } from "@/components/Post";

const stories = [
  { name: "Lena Park", hue: 200 },
  { name: "Sam Okafor", hue: 20 },
  { name: "Dev Patel", hue: 140 },
  { name: "Rosa Jimenez", hue: 320 },
];

export default function Home() {
  const me = profileById(ME)!;
  const ev = EVENTS[0];
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1">
        <div className="bg-white px-3 py-2 flex items-center gap-2">
          <Avatar p={me} size={40} />
          <div className="flex-1 h-10 rounded-full border border-line/70 px-4 flex items-center text-[15px] text-sub">What&apos;s on your mind?</div>
          <ImageIcon size={24} className="text-[#45bd62]" />
        </div>
        <div className="bg-white mt-2 py-3 px-3 flex gap-2 overflow-x-auto">
          <div className="w-[100px] h-[170px] shrink-0 rounded-xl overflow-hidden border border-line/50 flex flex-col">
            <div className="flex-1 grid place-items-center" style={{ background: `linear-gradient(135deg,hsl(${me.hue} 70% 70%),hsl(${me.hue + 40} 70% 50%))` }}>
              <span className="text-white text-3xl font-bold">MC</span>
            </div>
            <div className="h-12 relative text-center text-[12px] font-semibold pt-5">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-fb border-4 border-white grid place-items-center"><Plus size={16} color="#fff" strokeWidth={3} /></span>
              Create story
            </div>
          </div>
          {stories.map((s) => (
            <div key={s.name} className="w-[100px] h-[170px] shrink-0 rounded-xl overflow-hidden relative" style={{ background: `linear-gradient(160deg,hsl(${s.hue} 60% 65%),hsl(${s.hue + 60} 60% 35%))` }}>
              <div className="absolute top-2 left-2"><Avatar p={{ name: s.name.split(" ")[0], lastName: s.name.split(" ")[1], hue: s.hue }} size={34} ring="#0866ff" /></div>
              <div className="absolute bottom-2 left-2 right-2 text-white text-[12px] font-semibold leading-tight">{s.name}</div>
            </div>
          ))}
        </div>

        <Post author="Austin Indie Music Fans" hue={330} meta="Admin · 2h" text="Pale Hour's first Austin show is THIS Saturday 🎶 Don't have anyone to go with? Join a crew from the event page. Muse will match you with a small group nearby who'll meet up first." likes={248} comments={57}>
          <Link href={`/events/${ev.id}`} className="block" data-testid="feed-event">
            <div className="h-44 relative" style={{ background: ev.cover }}>
              <span className="absolute top-2 left-2 bg-white/95 text-[12px] font-semibold px-2 py-1 rounded-full">✦ Crews forming nearby</span>
            </div>
            <div className="bg-fbbg px-3 py-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[#c2185b] uppercase">Sat, Nov 14 at {pretty(ev.startTime)}</div>
                <div className="font-semibold text-[15px] truncate">{ev.title}</div>
                <div className="text-[13px] text-sub truncate">{ev.venueName} · {ev.interestedCount.toLocaleString()} interested</div>
              </div>
              <span className="h-9 px-3 rounded-md bg-[#e4e6eb] font-semibold text-[14px] grid place-items-center">★ Interested</span>
            </div>
          </Link>
        </Post>

        <Post author="Lena Park" hue={200} meta="5h" text="Davis → Austin pipeline is real. Maya just moved here, someone take her to a show 😤" likes={41} comments={12} />

        <Post author="Bouldering ATX" hue={90} meta="Yesterday" text="New set on the cave wall! Beginner night is Thursday, first session free." likes={133} comments={22}>
          <div className="h-40" style={{ background: "linear-gradient(135deg,#5b7f3a,#a3c46b 60%,#e6d27a)" }} />
        </Post>
        <div className="h-4" />
      </main>
      <TabBar active="/" />
    </div>
  );
}
