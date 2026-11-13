/**
 * "Join with Glance": a link from an event here to the same event in Glance, the
 * companion app that recognizes people who turned it on and suggests what to talk about.
 *
 * Glance is a separate app with its own accounts and data. Nothing is sent to it from
 * our server: this only builds a link the person chooses to open. The link carries the
 * event's id, title and venue, and the person's name so their Glance profile starts
 * filled in. Glance creates its own event for ours the first time anyone opens the
 * link, so everyone joining from the same page here lands in the same place there.
 */

/** Where Glance runs unless NEXT_PUBLIC_GLANCE_URL says otherwise. */
export const GLANCE_DEFAULT_URL = "https://glancear.vercel.app";

/**
 * The Glance site to link to, or null to hide the feature. Set NEXT_PUBLIC_GLANCE_URL to
 * "off" to hide it. Anything that is not https (or http on localhost, for development)
 * also hides it, so a mistyped value can never send people to an unexpected place.
 */
export function glanceBaseUrl(configured: string | undefined = process.env.NEXT_PUBLIC_GLANCE_URL): string | null {
  const value = (configured ?? "").trim() || GLANCE_DEFAULT_URL;
  if (value.toLowerCase() === "off") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Ids Glance accepts: letters, digits, dash and underscore, at most 64. */
const GLANCE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The link that opens this event in Glance, or null when the feature is off or the
 * event cannot be represented there. Text is cut to the lengths Glance accepts.
 */
export function glanceJoinUrl(
  event: { id: string; title: string; venueName?: string | null },
  personName?: string | null,
  base: string | null = glanceBaseUrl(),
): string | null {
  const title = event.title.trim().slice(0, 100);
  if (!base || !GLANCE_ID.test(event.id) || !title) return null;
  const query = new URLSearchParams({ source: "metaintros", id: event.id, title });
  const place = (event.venueName ?? "").trim().slice(0, 160);
  if (place) query.set("place", place);
  const name = (personName ?? "").trim().slice(0, 80);
  if (name) query.set("name", name);
  // Glance routes inside the URL fragment, so the query goes after "#/join".
  return `${base}/#/join?${query.toString()}`;
}
