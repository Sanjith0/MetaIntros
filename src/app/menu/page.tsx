"use client";
import Link from "next/link";
import { CalendarDays, Glasses, RotateCcw, Users } from "lucide-react";
import { ME, profileById } from "@/data/seed";
import { Avatar, MuseMark, TabBar, TopBar } from "@/components/ui";

export default function MenuPage() {
  const me = profileById(ME)!;
  const items = [
    { href: "/events", label: "Events", Icon: CalendarDays, color: "#e41e3f" },
    { href: "/crews", label: "Crews", Icon: Users, color: "#7b3fe4" },
    { href: "/glasses", label: "Glasses (P3 concept)", Icon: Glasses, color: "#0866ff" },
  ];
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1 p-3 space-y-3">
        <h1 className="text-2xl font-bold px-1">Menu</h1>
        <div className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <Avatar p={me} size={40} />
          <div className="font-semibold">{me.name} {me.lastName}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map(({ href, label, Icon, color }) => (
            <Link key={href} href={href} className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2">
              <Icon size={26} color={color} />
              <span className="font-semibold text-[15px]">{label}</span>
            </Link>
          ))}
          <button
            className="bg-white rounded-xl p-3 shadow-sm flex flex-col gap-2 text-left"
            data-testid="reset-demo"
            onClick={async () => {
              await fetch("/api/reset", { method: "POST" });
              try { sessionStorage.clear(); } catch {}
              location.href = "/";
            }}
          >
            <RotateCcw size={26} color="#65676b" />
            <span className="font-semibold text-[15px]">Reset demo</span>
          </button>
        </div>
        <p className="text-xs text-sub px-1 flex items-center gap-1"><MuseMark size={12} /> Crews is a hackathon prototype on seeded data. All people are fictional.</p>
      </main>
      <TabBar active="/menu" />
    </div>
  );
}
