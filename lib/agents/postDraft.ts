/**
 * Post Draft Agent ("Let AI suggest a post"): picks up to 4 photos from the squad album and writes a
 * short caption. The model never receives image bytes (privacy, and multimodal output is unverified):
 * only photo ids with metadata (uploader first name, the photo's caption, minutes since the event
 * started, whether it's the poster's own), the event, the squad's top shared interests (labels only)
 * and the poster's first name. No last names, ever.
 *
 * Code, not the model, enforces the rules afterwards (sanitizeDraft): only photos the poster may use,
 * at most 4, no sensitive text, and no squadmate named unless they're the poster's friend. If the
 * caption can't be salvaged, a template is used and labeled as such.
 */
import { z } from "zod";
import { runAi, type AiSource } from "@/lib/ai";
import { isSensitiveText } from "@/lib/cards/claims";

export const MAX_DRAFT_PHOTOS = 4;
export const MAX_DRAFT_CAPTION = 220;

const Out = z.object({ photoIds: z.array(z.string()).max(20), caption: z.string().max(1000) });

export interface DraftPhoto {
  id: string;
  uploaderFirstName: string;
  caption: string | null;
  /** minutes between the event's start and the upload (negative = before doors) */
  minutesSinceStart: number;
  own: boolean;
}

export interface PostDraftInput {
  posterFirstName: string;
  event: { title: string; kind: "event" | "hangout" };
  /** non-sensitive interest labels the squad shares, strongest first */
  sharedInterests: string[];
  /** only photos the poster is allowed to use (their own, or a squadmate's with consent on) */
  photos: DraftPhoto[];
  /**
   * Names (first and last) of squadmates who are NOT the poster's friends. Code-side only: never sent
   * to the model; any caption sentence that mentions one is dropped.
   */
  hiddenNames: string[];
}

export interface PostDraft {
  photoIds: string[];
  caption: string;
}

export const shortTitle = (title: string) => title.split(/[:—–]/)[0].trim() || title;

/** Deterministic draft: own photos first, then squadmates' (upload order), and a plain caption. */
export function postTemplate(i: PostDraftInput): PostDraft {
  const ordered = [...i.photos.filter((p) => p.own), ...i.photos.filter((p) => !p.own)];
  return { photoIds: ordered.slice(0, MAX_DRAFT_PHOTOS).map((p) => p.id), caption: `${shortTitle(i.event.title)} with my Queue Up squad.` };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentionsAny(text: string, names: string[]) {
  return names.some((n) => n.length > 1 && new RegExp(`(^|[^\\p{L}])${escapeRe(n)}($|[^\\p{L}])`, "iu").test(text));
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.match(/^[\s\S]*[.?!](?=\s|$)/)?.[0];
  if (sentence && sentence.length > max / 2) return sentence.trim();
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).trim()}…`;
}

export interface Sanitized extends PostDraft {
  /** sentences or ids removed by code */
  stripped: number;
  /** the caption had to be replaced by the template */
  captionFromTemplate: boolean;
}

/** Enforce the rules on whatever the model returned. */
export function sanitizeDraft(raw: PostDraft, i: PostDraftInput): Sanitized {
  const allowed = new Set(i.photos.map((p) => p.id));
  const tpl = postTemplate(i);
  let stripped = 0;

  let ids = [...new Set(raw.photoIds)].filter((id) => allowed.has(id));
  stripped += raw.photoIds.length - ids.length;
  if (ids.length > MAX_DRAFT_PHOTOS) {
    stripped += ids.length - MAX_DRAFT_PHOTOS;
    ids = ids.slice(0, MAX_DRAFT_PHOTOS);
  }
  if (!ids.length) ids = tpl.photoIds;

  const sentences = raw.caption.replace(/\s+/g, " ").trim().split(/(?<=[.?!])\s+/).filter(Boolean);
  const kept = sentences.filter((s) => !isSensitiveText(s) && !mentionsAny(s, i.hiddenNames));
  stripped += sentences.length - kept.length;
  let caption = truncate(kept.join(" ").trim(), MAX_DRAFT_CAPTION);
  let captionFromTemplate = false;
  if (caption.length < 3) {
    caption = tpl.caption;
    captionFromTemplate = true;
  }
  return { photoIds: ids, caption, stripped, captionFromTemplate };
}

export async function draftPost(i: PostDraftInput): Promise<PostDraft & { source: AiSource; stripped: number }> {
  const ai = await runAi<PostDraft>({
    task: "post_draft",
    system:
      "You help someone share a Facebook post about an outing with their Queue Up squad (people they met through the app). " +
      "You cannot see the photos: choose up to 4 photo ids from the list using only the metadata (prefer the poster's own photos, a mix of moments, and photos with captions), in the order they should appear. " +
      "Write one short, warm caption in the poster's voice (first person, max 220 characters, at most 2 sentences). " +
      "Don't name any squadmate, don't invent details beyond the event, photo captions and shared interests, " +
      "and never mention politics, religion, health or sexuality. No hashtags, no emoji, no exclamation marks. " +
      'JSON only: {"photoIds": ["..."], "caption": "..."}.',
    user: JSON.stringify({
      poster: i.posterFirstName,
      event: { title: i.event.title, kind: i.event.kind === "hangout" ? "a hangout Queue Up planned for the squad" : "an event" },
      squadSharedInterests: i.sharedInterests.slice(0, 5),
      photos: i.photos.map((p) => ({ id: p.id, by: p.own ? "the poster" : p.uploaderFirstName, caption: p.caption ?? "", minutesSinceEventStart: p.minutesSinceStart })),
    }),
    schema: Out,
    fallback: () => postTemplate(i),
    maxTokens: 500,
    temperature: 0.6,
    timeoutMs: 8_000,
  });
  const clean = sanitizeDraft(ai.value, i);
  // never call a template "AI": if code had to replace the caption, label it as a template
  const source: AiSource = clean.captionFromTemplate ? "fallback" : ai.source;
  return { photoIds: clean.photoIds, caption: clean.caption, source, stripped: clean.stripped };
}
