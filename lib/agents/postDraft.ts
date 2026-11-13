/**
 * Post Draft Agent ("Post ideas from your night"): a one or two line recap of what the squad talked
 * about, and up to 3 post ideas, each with up to 4 photos from the squad album and a short caption. The model never receives image bytes (privacy, and multimodal output is unverified):
 * only photo ids with metadata (uploader first name, the photo's caption, minutes since the event
 * started, whether it's the poster's own), the event, the squad's top shared interests (labels only),
 * the poster's first name and what squadmates wrote in the squad chat (first names, last names masked,
 * sensitive messages dropped). No last names, ever.
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
export const MAX_IDEAS = 3;
export const MAX_RECAP = 200;
export const MAX_CHAT_LINES = 40;
export const MAX_CHAT_LINE = 200;

export type IdeaStyle = "event" | "chat" | "casual";
const STYLES: IdeaStyle[] = ["event", "chat", "casual"];

const Idea = z.object({ style: z.string().max(20).optional(), photoIds: z.array(z.string()).max(20), caption: z.string().max(1000) });
const Out = z.object({ recap: z.string().max(1000).optional(), ideas: z.array(Idea).max(10) });

/** One squad chat message as the model sees it: "you" for the poster, else a first name. */
export interface ChatLine {
  by: string;
  text: string;
}

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
  /** what people wrote in the squad chat, oldest first (already filtered; see suggestPost) */
  chat?: ChatLine[];
}

export interface PostDraft {
  photoIds: string[];
  caption: string;
}

export const shortTitle = (title: string) => title.split(/[:—–]/)[0].trim() || title;

/** Deterministic draft: own photos first, then squadmates' (upload order), and a plain caption. */
export function postTemplate(i: PostDraftInput): PostDraft {
  const ordered = [...i.photos.filter((p) => p.own), ...i.photos.filter((p) => !p.own)];
  return { photoIds: ordered.slice(0, MAX_DRAFT_PHOTOS).map((p) => p.id), caption: `${shortTitle(i.event.title)} with my Link squad.` };
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

/** A sentence may be shown if it isn't sensitive, names nobody who must stay unnamed, and doesn't copy a masked "[name]". */
function keepSentence(s: string, hiddenNames: string[]) {
  return !isSensitiveText(s) && !mentionsAny(s, hiddenNames) && !s.includes("[name]");
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
  const kept = sentences.filter((s) => keepSentence(s, i.hiddenNames));
  stripped += sentences.length - kept.length;
  let caption = truncate(kept.join(" ").trim(), MAX_DRAFT_CAPTION);
  let captionFromTemplate = false;
  if (caption.length < 3) {
    caption = tpl.caption;
    captionFromTemplate = true;
  }
  return { photoIds: ids, caption, stripped, captionFromTemplate };
}

export interface PostIdea extends PostDraft {
  style: IdeaStyle;
}

/** Keep the sentences that are safe to show: not sensitive, and naming nobody who must stay unnamed. */
function safeSentences(text: string, hiddenNames: string[]) {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.?!])\s+/).filter(Boolean);
  const kept = sentences.filter((s) => keepSentence(s, hiddenNames));
  return { text: kept.join(" ").trim(), stripped: sentences.length - kept.length };
}

/** Enforce the rules on the recap and every idea. Never returns zero ideas. */
export function sanitizeIdeas(raw: { recap?: string; ideas: (PostDraft & { style?: string })[] }, i: PostDraftInput) {
  let stripped = 0;
  const ideas: PostIdea[] = [];
  const seen = new Set<string>();
  for (const r of raw.ideas) {
    const clean = sanitizeDraft(r, i);
    stripped += clean.stripped;
    const key = clean.caption.toLowerCase();
    if (clean.captionFromTemplate || seen.has(key)) {
      stripped += 1;
      continue;
    }
    if (ideas.length >= MAX_IDEAS) {
      stripped += 1;
      continue;
    }
    seen.add(key);
    const style = STYLES.includes(r.style as IdeaStyle) ? (r.style as IdeaStyle) : "casual";
    ideas.push({ style, photoIds: clean.photoIds, caption: clean.caption });
  }
  const fromTemplate = ideas.length === 0;
  if (fromTemplate) ideas.push({ style: "event", ...postTemplate(i) });

  let recap: string | null = null;
  if (i.chat?.length && raw.recap && !fromTemplate) {
    const r = safeSentences(raw.recap, i.hiddenNames);
    stripped += r.stripped;
    const t = truncate(r.text, MAX_RECAP);
    recap = t.length >= 3 ? t : null;
  }
  return { recap, ideas, stripped, fromTemplate };
}

export async function draftPostIdeas(i: PostDraftInput): Promise<{ recap: string | null; ideas: PostIdea[]; source: AiSource; stripped: number }> {
  const ai = await runAi<z.infer<typeof Out>>({
    task: "post_ideas",
    system:
      "You help someone share a Facebook post about an outing with their Link squad (people they met through the app). " +
      "First, write a recap: one or two short sentences on what the squad talked about in their group chat, in second person (\"Your squad...\"). Leave it empty if the chat is empty. " +
      "Then suggest 3 different post ideas, in this order: style \"event\" (about the event itself), style \"chat\" (built from something the squad talked about), style \"casual\" (short and casual). " +
      "You cannot see the photos: for each idea choose up to 4 photo ids from the list using only the metadata (prefer the poster's own photos, a mix of moments, and photos with captions), in the order they should appear. Vary the photos across ideas when there are enough. " +
      "Each caption is in the poster's voice (first person, max 220 characters, at most 2 sentences). " +
      "Use the chat only for shared plans, activities and topics the squad talked about: never mention anyone's personal news, feelings, problems or private details, even without a name. " +
      "Don't name any squadmate, don't invent details beyond the event, the chat, photo captions and shared interests, " +
      "and never mention politics, religion, health or sexuality. No hashtags, no emoji, no exclamation marks. " +
      'JSON only: {"recap": "...", "ideas": [{"style": "event", "photoIds": ["..."], "caption": "..."}]}.',
    user: JSON.stringify({
      poster: i.posterFirstName,
      event: { title: i.event.title, kind: i.event.kind === "hangout" ? "a hangout Link planned for the squad" : "an event" },
      squadSharedInterests: i.sharedInterests.slice(0, 5),
      photos: i.photos.map((p) => ({ id: p.id, by: p.own ? "the poster" : p.uploaderFirstName, caption: p.caption ?? "", minutesSinceEventStart: p.minutesSinceStart })),
      chat: i.chat ?? [],
    }),
    schema: Out,
    fallback: () => ({ ideas: [{ style: "event", ...postTemplate(i) }] }),
    maxTokens: 900,
    temperature: 0.6,
    timeoutMs: 10_000,
  });
  const clean = sanitizeIdeas(ai.value, i);
  // never call a template "AI": if code had to fall back to the template, label it as one
  const source: AiSource = clean.fromTemplate ? "fallback" : ai.source;
  return { recap: clean.recap, ideas: clean.ideas, source, stripped: clean.stripped };
}
