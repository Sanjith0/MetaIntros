"use client";

import { RefreshCw } from "lucide-react";
import { Button, Section } from "@/components/fb";
import { PrototypeLabel } from "@/components/fb/TopBar";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div data-testid="error-state">
      <PrototypeLabel />
      <Section className="mt-2 py-8 text-center">
        <p className="text-headline font-bold">Something went wrong</p>
        <p className="mt-1 text-body text-muted">Your squad is fine. This screen just didn&apos;t load.</p>
        <Button className="mt-4" onClick={reset} icon={<RefreshCw size={16} />}>Try again</Button>
      </Section>
    </div>
  );
}
