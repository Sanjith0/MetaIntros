import { Glasses } from "lucide-react";
import { ButtonLink, Section } from "@/components/fb";

/**
 * The event page's way into Glance, a separate companion app. A grey button, because
 * the page's one primary action is Queue Up. It opens in a new tab so the event stays put.
 */
export function GlanceJoin({ href }: { href: string }) {
  return (
    <Section title="Meet people with Glance" testId="glance-join">
      <p className="text-body text-muted">
        Glance recognizes people at this event who also turned it on, and gives you something to talk about with each of them. It works with
        your phone camera or Meta glasses.
      </p>
      <ButtonLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        variant="secondary"
        block
        className="mt-3"
        icon={<Glasses size={16} aria-hidden />}
        data-testid="glance-join-button"
      >
        Join with Glance
      </ButtonLink>
      <p className="mt-2 text-meta text-muted">
        Opens Glance, a separate app, with this event and your name filled in. You add a face scan there only if you choose to.
      </p>
    </Section>
  );
}
