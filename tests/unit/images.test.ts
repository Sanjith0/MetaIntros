import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COVER_IDS, eventCoverSrc } from "@/lib/images";
import { POSTS, STORIES, VIDEOS } from "@/lib/mock/feed";
import { PROMPTS } from "../../scripts/image-prompts";

const onDisk = (url: string) => existsSync(`public${url}`);

describe("seeded photos (public/images)", () => {
  it("every seeded event has a cover photo, and every cover is a seeded event", () => {
    const seeded = (JSON.parse(readFileSync("data/seed/events.json", "utf8")) as { id: string }[]).map((e) => e.id);
    expect([...COVER_IDS].sort()).toEqual([...seeded].sort());
    for (const id of seeded) expect(onDisk(eventCoverSrc(id)!), id).toBe(true);
  });

  it("events without a photo keep their colour cover", () => {
    expect(eventCoverSrc("hangout-123")).toBeUndefined();
  });

  it("every photo the mock feed points at exists", () => {
    const urls = [...POSTS.flatMap((p) => [p.avatar, "photo" in p ? p.photo : undefined]), ...STORIES.map((s) => s.photo), ...VIDEOS.flatMap((v) => [v.avatar, v.thumb])].filter(Boolean) as string[];
    expect(urls.length).toBeGreaterThan(10);
    for (const u of urls) expect(onDisk(u), u).toBe(true);
  });

  it("every prompt has its generated file, so the images can be reproduced", () => {
    for (const key of Object.keys(PROMPTS)) expect(existsSync(`public/images/${key}`), key).toBe(true);
  });
});
