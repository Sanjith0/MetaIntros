import { Glasses } from "lucide-react";
import { ButtonLink, Section } from "@/components/fb";

/**
 * The event page's way into Glance, a separate companion app. A grey button, because
 * the page's one primary action is Queue Up. It opens in a new tab so the event stays put.
 *
 * One line of copy at most, like the rest of the page: the title and the button say what
 * it is. That line is the disclosure, so it stays: it tells people they are leaving for
 * another app and that the event and their name go with them.
 */
export function GlanceJoin({ href }: { href: string }) {
  return (
    <Section title="Meet people with Glance" testId="glance-join">
      <ButtonLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        variant="secondary"
        block
        icon={<Glasses size={16} aria-hidden />}
        data-testid="glance-join-button"
      >
        Join with Glance
      </ButtonLink>
      <p className="mt-2 text-meta text-muted">Opens Glance, a separate app, with this event and your name filled in.</p>
    </Section>
  );
}
