import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mockProvider } from "@/lib/ai";
import { seedDatabase } from "@/lib/seed/seed";
import { addAlbumPhoto, deleteAlbumPhoto, getAlbumPhotoData, listAlbum, MAX_ALBUM_PHOTOS, updateAlbumPhoto } from "@/lib/server/album";
import { createPost, declineShare, getPostPhotoData, listFeed, shareState, suggestPost, STORY_TTL_MS } from "@/lib/server/posts";
import { postTemplate, sanitizeDraft, type PostDraftInput } from "@/lib/agents/postDraft";
import { fastForward } from "@/lib/server/expiry";
import { getStatusCard } from "@/lib/server/status";
import { listNotifications } from "@/lib/server/notifications";
import { setPartyPhoto } from "@/lib/server/companion";
import { createSampleLiveUser, deleteLiveUser } from "@/lib/server/signup";
import { now, setClockOffsetMs } from "@/lib/server/clock";
import { normalizePair } from "@/lib/domain/enums";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// p01 Jordan Lee (Me) · p02 Freya Rossi (Jordan's friend) · p03 Zoe Kim and p05 Yuki Dubois (not Jordan's friends)
// p66 is Jordan's friend but outside the squad.
const SQUAD = ["p01", "p02", "p03", "p05"];

async function makeSquad(members = SQUAD, status = "confirmed") {
  const ev = await prisma.event.findUniqueOrThrow({ where: { id: "ev-indie-guild" } });
  return prisma.party.create({
    data: {
      eventId: ev.id,
      landmarkId: "lm-downtown-pa",
      targetSize: members.length,
      ageBand: "18-24",
      status,
      members: { create: members.map((userId) => ({ userId })) },
      chat: { create: { type: "squad", title: "Indie Night Squad", eventId: ev.id, expiresAt: new Date(ev.endsAt.getTime() + 24 * 3600_000), members: { create: members.map((userId) => ({ userId })) } } },
    },
  });
}

async function photo(partyId: string, userId: string, extra: { caption?: string; shareable?: boolean } = {}) {
  const r = await addAlbumPhoto(partyId, userId, { dataUrl: PNG, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe("squad album", () => {
  let partyId = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    mockProvider().reset();
    partyId = (await makeSquad()).id;
  });

  it("members of a ready squad can add and see photos; everyone else gets nothing", async () => {
    const id = await photo(partyId, "p02", { caption: "Front row" });
    const a = await listAlbum(partyId, "p01");
    expect(a!.photos).toHaveLength(1);
    expect(a!.photos[0]).toMatchObject({ id, caption: "Front row", shareable: true, mine: false, url: `/api/squad/${partyId}/album/${id}` });
    expect(await getAlbumPhotoData(partyId, "p01", id)).toBe(PNG);
    // outsider (even a friend of a member): no list, no bytes, no upload
    expect(await listAlbum(partyId, "p66")).toBeNull();
    expect(await getAlbumPhotoData(partyId, "p66", id)).toBeNull();
    expect(await addAlbumPhoto(partyId, "p66", { dataUrl: PNG })).toMatchObject({ ok: false, error: "not_found" });
    // a squad that isn't ready yet has no album
    const forming = await makeSquad(["p01", "p02"], "forming");
    expect(await listAlbum(forming.id, "p01")).toBeNull();
    expect(await addAlbumPhoto(forming.id, "p01", { dataUrl: PNG })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("validates images and captions, and caps the album", async () => {
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: "javascript:alert(1)" })).toMatchObject({ ok: false, error: "bad_image" });
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: "data:image/gif;base64,R0lGOD" })).toMatchObject({ ok: false, error: "bad_image" });
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: `data:image/jpeg;base64,${"A".repeat(900_000)}` })).toMatchObject({ ok: false, error: "bad_image" });
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: PNG, caption: "x".repeat(81) })).toMatchObject({ ok: false, error: "caption_too_long" });
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: PNG, caption: "After the election rally" })).toMatchObject({ ok: false, error: "sensitive_caption" });
    await prisma.albumPhoto.createMany({ data: Array.from({ length: MAX_ALBUM_PHOTOS }, () => ({ partyId, uploaderId: "p02", dataUrl: PNG })) });
    expect(await addAlbumPhoto(partyId, "p01", { dataUrl: PNG })).toMatchObject({ ok: false, error: "album_full" });
    expect((await listAlbum(partyId, "p01"))!.full).toBe(true);
  });

  it("only the uploader can change consent or delete; the album outlives the squad chat", async () => {
    const id = await photo(partyId, "p03");
    expect(await updateAlbumPhoto(partyId, "p01", id, { shareable: false })).toMatchObject({ ok: false, error: "not_found" });
    expect(await deleteAlbumPhoto(partyId, "p01", id)).toMatchObject({ ok: false, error: "not_found" });
    expect((await updateAlbumPhoto(partyId, "p03", id, { shareable: false, caption: "Encore" })).ok).toBe(true);
    expect((await listAlbum(partyId, "p03"))!.photos[0]).toMatchObject({ shareable: false, caption: "Encore", mine: true });

    await setPartyPhoto(partyId, "p01", PNG); // a find-me photo, which the chat ending deletes
    await fastForward();
    const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId }, include: { chat: true, members: true } });
    expect(party.chat!.archived).toBe(true);
    expect(party.members.every((m) => m.photoUrl === null)).toBe(true);
    expect((await listAlbum(partyId, "p01"))!.photos).toHaveLength(1); // the album is the memory
    expect((await deleteAlbumPhoto(partyId, "p03", id)).ok).toBe(true); // delete still works after
    expect((await listAlbum(partyId, "p01"))!.photos).toHaveLength(0);
  });

  it("deleting an account removes their album photos", async () => {
    const live = (await createSampleLiveUser(prisma, { name: "Kim Live", ageBand: "18-24", gender: null, womenOnlyParty: false })).userId;
    await prisma.partyMember.create({ data: { partyId, userId: live } });
    await photo(partyId, live);
    expect(await prisma.albumPhoto.count({ where: { uploaderId: live } })).toBe(1);
    await deleteLiveUser(prisma, live);
    expect(await prisma.albumPhoto.count({ where: { uploaderId: live } })).toBe(0);
  });
});

describe("posts and stories", () => {
  let partyId = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    mockProvider().reset();
    partyId = (await makeSquad()).id;
  });

  it("per-photo consent is enforced in code: own photos always, squadmates' only while allowed", async () => {
    const mine = await photo(partyId, "p01");
    const ok = await photo(partyId, "p02");
    const locked = await photo(partyId, "p03", { shareable: false });
    expect(await createPost("p01", { kind: "post", audience: "friends", caption: "", partyId, photoIds: [locked] })).toMatchObject({ ok: false, error: "photo_not_allowed" });
    expect(await createPost("p66", { kind: "post", audience: "friends", caption: "hi", partyId, photoIds: [mine] })).toMatchObject({ ok: false, error: "not_found" });
    expect(await createPost("p01", { kind: "post", audience: "friends", caption: "", photoIds: [mine] })).toMatchObject({ ok: false, error: "photo_not_allowed" }); // photos need their squad
    expect(await createPost("p01", { kind: "post", audience: "friends", caption: "  " })).toMatchObject({ ok: false, error: "empty" });
    const other = await makeSquad(["p02", "p05"]);
    const elsewhere = await photo(other.id, "p02");
    expect(await createPost("p01", { kind: "post", audience: "friends", caption: "", partyId, photoIds: [elsewhere] })).toMatchObject({ ok: false, error: "photo_not_allowed" });
    const r = await createPost("p01", { kind: "post", audience: "friends", caption: "What a night", partyId, photoIds: [ok, mine] });
    expect(r.ok).toBe(true);
    const p = await prisma.post.findUniqueOrThrow({ where: { id: (r as { id: string }).id }, include: { photos: { orderBy: { position: "asc" } } } });
    expect(p.photos.map((x) => x.photoId)).toEqual([ok, mine]);
    expect(p.eventId).toBe("ev-indie-guild");
    expect((await prisma.shareChoice.findUniqueOrThrow({ where: { partyId_userId: { partyId, userId: "p01" } } })).choice).toBe("own");
  });

  it("audience, blocks and consent decide who sees what, on every view", async () => {
    const mine = await photo(partyId, "p01");
    const freyas = await photo(partyId, "p02");
    const r = (await createPost("p01", { kind: "post", audience: "friends", caption: "Indie Night", partyId, photoIds: [mine, freyas] })) as { id: string };
    await createPost("p01", { kind: "post", audience: "only_me", caption: "Just for me" });
    const at = await now();

    const own = await listFeed("p01", at);
    expect(own.posts.map((p) => p.caption)).toEqual(["Just for me", "Indie Night"]);
    expect(own.posts[1].event?.title).toMatch(/Indie Night/);
    const friend = await listFeed("p02", at); // Freya is Jordan's friend
    expect(friend.posts.map((p) => p.caption)).toEqual(["Indie Night"]);
    expect(friend.posts[0].photos.map((p) => p.url)).toEqual([`/api/posts/${r.id}/photos/${mine}`, `/api/posts/${r.id}/photos/${freyas}`]);
    expect((await listFeed("p03", at)).posts).toHaveLength(0); // squadmate, but not Jordan's friend
    expect(await getPostPhotoData("p02", r.id, mine, at)).toBe(PNG);
    expect(await getPostPhotoData("p03", r.id, mine, at)).toBeNull();
    expect(await getPostPhotoData("p02", r.id, "not-in-post", at)).toBeNull();

    // Freya turns consent off later: her photo leaves the post for everyone; Jordan's own photo stays
    await updateAlbumPhoto(partyId, "p02", freyas, { shareable: false });
    expect((await listFeed("p02", at)).posts[0].photos.map((p) => p.id)).toEqual([mine]);
    expect(await getPostPhotoData("p02", r.id, freyas, at)).toBeNull();
    expect(await getPostPhotoData("p01", r.id, mine, at)).toBe(PNG);
    // deleting an album photo drops it from the post; a post with no photos and no caption disappears
    await deleteAlbumPhoto(partyId, "p01", mine);
    expect((await listFeed("p02", at)).posts[0].photos).toHaveLength(0);

    // blocked users never see each other's posts, even as friends
    const [a, b] = normalizePair("p01", "p09");
    await prisma.friendship.create({ data: { userAId: a, userBId: b } });
    await createPost("p09", { kind: "post", audience: "friends", caption: "from p09" });
    expect((await listFeed("p01", at)).posts.map((p) => p.caption)).not.toContain("from p09");
    expect((await listFeed("p09", at)).posts.map((p) => p.caption)).not.toContain("Indie Night");
  });

  it("stories expire 24h after posting, on the global clock", async () => {
    const mine = await photo(partyId, "p01");
    const r = (await createPost("p01", { kind: "story", audience: "friends", caption: "", partyId, photoIds: [mine] })) as { id: string };
    const s = await listFeed("p02", await now());
    expect(s.posts).toHaveLength(0);
    expect(s.stories).toHaveLength(1);
    expect(s.stories[0]).toMatchObject({ author: { id: "p01" }, mine: false });
    expect(await getPostPhotoData("p02", r.id, mine, await now())).toBe(PNG);
    await setClockOffsetMs(STORY_TTL_MS + 60_000);
    expect((await listFeed("p02", await now())).stories).toHaveLength(0);
    expect((await listFeed("p01", await now())).stories).toHaveLength(0);
    expect(await getPostPhotoData("p02", r.id, mine, await now())).toBeNull();
  });

  it("squadmates who can see the post get a notification", async () => {
    await createPost("p01", { kind: "post", audience: "friends", caption: "Great show", partyId });
    expect((await listNotifications("p02", await now())).some((n) => n.kind === "squad_post")).toBe(true);
    expect((await listNotifications("p03", await now())).some((n) => n.kind === "squad_post")).toBe(false); // not a friend
  });
});

describe("share the outing", () => {
  let partyId = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    mockProvider().reset();
    partyId = (await makeSquad()).id;
  });

  it("opens after the event; Don't post is remembered and the status card moves on", async () => {
    expect((await shareState(partyId, "p01", await now()))!.open).toBe(false);
    expect(await declineShare(partyId, "p01", await now())).toMatchObject({ ok: false, error: "not_over" });
    expect(await suggestPost(partyId, "p01", await now())).toMatchObject({ ok: false, error: "not_over" });
    expect(await shareState(partyId, "p66", await now())).toBeNull();
    await fastForward();
    const s = await shareState(partyId, "p01", await now());
    expect(s).toMatchObject({ open: true, choice: null });

    // after card: friends first, sharing as the quiet second link
    let card = await getStatusCard("p01", await now());
    expect(card).toMatchObject({ state: "after", action: { href: `/squad/${partyId}/connect` }, secondary: { href: `/squad/${partyId}/share` } });
    await prisma.friendRequest.createMany({ data: ["p02", "p03", "p05"].map((toId) => ({ fromId: "p01", toId, partyId })) });
    card = await getStatusCard("p01", await now());
    expect(card).toMatchObject({ state: "after", action: { label: "Share the outing", href: `/squad/${partyId}/share` } });
    expect(await declineShare(partyId, "p01", await now())).toMatchObject({ ok: true });
    expect((await shareState(partyId, "p01", await now()))!.choice).toBe("none");
    expect(await getStatusCard("p01", await now())).toBeNull();
  });

  it("only offers photos the poster may use", async () => {
    const mine = await photo(partyId, "p01");
    const ok = await photo(partyId, "p02");
    await photo(partyId, "p03", { shareable: false });
    const s = await shareState(partyId, "p01", await now());
    expect(s!.photos.map((p) => p.id).sort()).toEqual([mine, ok].sort());
  });
});

describe("post draft agent", () => {
  let partyId = "";
  beforeEach(async () => {
    await seedDatabase(prisma, { now: new Date() });
    mockProvider().reset();
    partyId = (await makeSquad()).id;
    await fastForward();
  });

  it("hostile model output is cleaned by code: bad photo ids, sensitive text and non-friends' names are stripped", async () => {
    const mine = await photo(partyId, "p01", { caption: "Opening band" });
    const freyas = await photo(partyId, "p02");
    const zoes = await photo(partyId, "p03");
    const locked = await photo(partyId, "p05", { shareable: false });
    mockProvider().on("post_draft", () =>
      JSON.stringify({
        photoIds: [locked, "made-up-id", zoes, freyas, mine, zoes, "another-fake"],
        caption: "Great night with Zoe and Freya. We talked about the election the whole time. The opening band was loud in the best way.",
      }),
    );
    const r = await suggestPost(partyId, "p01", await now());
    expect(r.ok).toBe(true);
    const d = (r as Extract<typeof r, { ok: true }>).draft;
    expect(d.photoIds).toEqual([zoes, freyas, mine]); // not-allowed and made-up ids dropped, duplicates removed
    expect(d.photoIds).not.toContain(locked);
    expect(d.caption).toBe("The opening band was loud in the best way.");
    expect(d.caption).not.toMatch(/Zoe|election/);
    expect(d.source).toBe("mock");
    expect(d.stripped).toBeGreaterThanOrEqual(4);

    // what the model saw: ids + metadata only. No image bytes, no last names, no consent-off photos.
    const call = mockProvider().calls.find((c) => c.task === "post_draft")!;
    const sent = call.messages.map((m) => m.content).join("\n");
    expect(sent).not.toContain("data:image");
    expect(sent).not.toContain("base64");
    for (const last of ["Lee", "Rossi", "Kim", "Dubois"]) expect(sent).not.toMatch(new RegExp(`\\b${last}\\b`));
    expect(sent).not.toContain(locked);
    const payload = JSON.parse(call.messages[1].content);
    expect(payload.poster).toBe("Jordan");
    expect(payload.photos.find((p: { id: string }) => p.id === mine)).toMatchObject({ by: "the poster", caption: "Opening band" });
    expect(payload.photos.find((p: { id: string }) => p.id === freyas)).toMatchObject({ by: "Freya" });
  });

  it("caps at 4 photos, and keeps a friend's name", async () => {
    const ids: string[] = [];
    for (const u of ["p01", "p01", "p02", "p02", "p03", "p05"]) ids.push(await photo(partyId, u));
    mockProvider().on("post_draft", () => JSON.stringify({ photoIds: ids, caption: "Indie Night with Freya and the squad." }));
    const d = (await suggestPost(partyId, "p01", await now())) as { ok: true; draft: { photoIds: string[]; caption: string; source: string } };
    expect(d.draft.photoIds).toEqual(ids.slice(0, 4));
    expect(d.draft.caption).toBe("Indie Night with Freya and the squad."); // Freya is Jordan's friend
  });

  it("falls back to a labeled template when the caption can't be salvaged or the model fails", async () => {
    const theirs = await photo(partyId, "p02");
    const mine = await photo(partyId, "p01");
    mockProvider().on("post_draft", () => JSON.stringify({ photoIds: ["nope"], caption: "Yuki and Zoe made it. Church after?" }));
    let d = (await suggestPost(partyId, "p01", await now())) as { ok: true; draft: { photoIds: string[]; caption: string; source: string } };
    expect(d.draft).toMatchObject({ photoIds: [mine, theirs], caption: "Indie Night with my Link squad.", source: "fallback" });

    mockProvider().reset(); // no handler → the model call fails → template
    d = (await suggestPost(partyId, "p01", await now())) as typeof d;
    expect(d.draft).toMatchObject({ photoIds: [mine, theirs], caption: "Indie Night with my Link squad.", source: "fallback" });
  });

  it("an AI-drafted post records its source and whether the caption was edited", async () => {
    const mine = await photo(partyId, "p01");
    const r = (await createPost("p01", { kind: "post", audience: "friends", caption: "Indie Night with my Link squad, again", partyId, photoIds: [mine], ai: { source: "live", caption: "Indie Night with my Link squad." } })) as { id: string };
    const p = await prisma.post.findUniqueOrThrow({ where: { id: r.id } });
    expect(p).toMatchObject({ aiSource: "live", aiEdited: true });
    expect((await prisma.shareChoice.findUniqueOrThrow({ where: { partyId_userId: { partyId, userId: "p01" } } })).choice).toBe("ai");
  });
});

describe("sanitizeDraft (pure)", () => {
  const input: PostDraftInput = {
    posterFirstName: "Jordan",
    event: { title: "Indie Night: Local Bands Showcase", kind: "event" },
    sharedInterests: ["Indie music"],
    photos: [
      { id: "a", uploaderFirstName: "Zoe", caption: null, minutesSinceStart: 30, own: false },
      { id: "b", uploaderFirstName: "Jordan", caption: null, minutesSinceStart: 40, own: true },
    ],
    hiddenNames: ["Zoe", "Kim"],
  };
  it("template puts own photos first", () => {
    expect(postTemplate(input)).toEqual({ photoIds: ["b", "a"], caption: "Indie Night with my Link squad." });
  });
  it("matches names on word boundaries only, case-insensitively", () => {
    expect(sanitizeDraft({ photoIds: ["a"], caption: "Zoetrope vibes all night." }, input).caption).toBe("Zoetrope vibes all night.");
    expect(sanitizeDraft({ photoIds: ["a"], caption: "Thanks ZOE. Loud and fun." }, input).caption).toBe("Loud and fun.");
    expect(sanitizeDraft({ photoIds: ["a"], caption: "We met Kim there. Great set." }, input).caption).toBe("Great set.");
  });
  it("truncates long captions", () => {
    const long = `${"Such a good night out with everyone. ".repeat(10)}`;
    expect(sanitizeDraft({ photoIds: [], caption: long }, input).caption.length).toBeLessThanOrEqual(221);
  });
});
