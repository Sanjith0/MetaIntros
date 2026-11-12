"use client";
import Link from "next/link";
import { Camera, ChevronLeft, Image as ImageIcon, Phone, PlusCircle, SendHorizontal, ThumbsUp, Video } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { EVENTS, ME, profileById } from "@/data/seed";
import { post } from "@/lib/client";
import { useCrew } from "@/lib/useCrew";
import type { CrewView } from "@/lib/types";
import { Avatar, MuseMark } from "@/components/ui";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { crew, setCrew } = useCrew(id, 600);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const n = crew?.chat.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [n]);
  if (!crew) return null;
  const ev = EVENTS.find((e) => e.id === crew.eventId)!;

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const t = text;
    setText("");
    setCrew(await post<CrewView>(`/api/crew/${id}/chat`, { userId: ME, text: t }));
    setSending(false);
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      <header className="h-14 px-2 flex items-center gap-2 border-b border-line/60">
        <Link href={`/crew/${id}`} className="w-9 h-9 grid place-items-center text-fb" aria-label="Back"><ChevronLeft size={28} /></Link>
        <div className="flex -space-x-2">
          {crew.memberIds.slice(0, 3).map((m) => (
            <Avatar key={m} p={profileById(m)!} size={28} ring="#fff" />
          ))}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[15px] truncate">{crew.vibe || "Crew"} · {ev.title.split(" — ")[0]}</div>
          <div className="text-xs text-sub">{crew.memberIds.length} people · Crew</div>
        </div>
        <div className="ml-auto flex gap-3 pr-2 text-[#0866ff]">
          <Phone size={22} fill="currentColor" />
          <Video size={24} fill="currentColor" />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2" data-testid="chat">
        <p className="text-center text-xs text-sub">Crew chat created by Crews · Messages from crewmates other than you are simulated in this demo</p>
        {crew.chat.map((m) => {
          const mine = m.authorId === ME;
          const ai = m.authorId === "assistant";
          const p = ai ? null : profileById(m.authorId)!;
          return (
            <div key={m.id} className={`flex gap-2 fade-up ${mine ? "justify-end" : ""}`}>
              {!mine && (ai ? <div className="w-7 h-7 rounded-full bg-[#f3ecff] grid place-items-center shrink-0"><MuseMark /></div> : <Avatar p={p!} size={28} />)}
              <div className="max-w-[78%]">
                {!mine && (
                  <div className="text-[11px] text-sub ml-2">
                    {ai ? "Crew assistant · AI" : p!.name}
                    {m.simulated && <span className="ml-1 text-[10px] bg-fbbg px-1 rounded">simulated</span>}
                  </div>
                )}
                <div className={`rounded-2xl px-3 py-2 text-[15px] ${mine ? "bg-fb text-white" : ai ? "bg-[#f3ecff]" : "bg-[#f0f0f0]"}`} data-testid={ai ? "assistant-msg" : undefined}>
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </main>
      <footer className="p-2 flex gap-2 items-center text-fb">
        <PlusCircle size={24} fill="currentColor" color="#fff" className="shrink-0" style={{ color: "#0866ff" }} />
        <Camera size={24} className="shrink-0" />
        <ImageIcon size={24} className="shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Aa"
          className="flex-1 min-w-0 h-9 rounded-full bg-[#f0f2f5] px-4 outline-none text-ink"
          data-testid="chat-input"
        />
        <button onClick={send} disabled={sending} className="text-fb w-9 h-9 grid place-items-center shrink-0" data-testid="chat-send" aria-label="Send">
          {text.trim() ? <SendHorizontal size={22} fill="currentColor" /> : <ThumbsUp size={22} fill="currentColor" />}
        </button>
      </footer>
    </div>
  );
}
