import { Link2Off } from "lucide-react";
import { ButtonLink, IconCircle } from "@/components/fb";
import { PrototypeLabel } from "@/components/fb/TopBar";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-wash" data-testid="not-found">
      <PrototypeLabel />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <IconCircle size={64}><Link2Off size={28} /></IconCircle>
        <h1 className="mt-4 text-headline font-bold">This content isn&apos;t available</h1>
        <p className="mt-1 text-body text-muted">It may have ended (squad chats close 24 hours after the event), or it&apos;s only visible to its squad.</p>
        <ButtonLink href="/events" variant="primary" className="mt-5">Go to Events</ButtonLink>
      </div>
    </main>
  );
}
