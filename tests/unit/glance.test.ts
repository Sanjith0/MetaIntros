import { describe, expect, it } from "vitest";
import { GLANCE_DEFAULT_URL, glanceBaseUrl, glanceJoinUrl } from "@/lib/glance";

const event = { id: "ev-indie-guild", title: "Indie Night: Local Bands Showcase", venueName: "The Guild Theatre" };
/** Reads the query Glance sees: everything after "#/join?". */
const query = (url: string) => new URLSearchParams(url.split("#/join?")[1]);

describe("where Glance is", () => {
  it("defaults to the Glance site and accepts another https site", () => {
    expect(glanceBaseUrl(undefined)).toBe(GLANCE_DEFAULT_URL);
    expect(glanceBaseUrl("  ")).toBe(GLANCE_DEFAULT_URL);
    expect(glanceBaseUrl("https://glance.example.com/")).toBe("https://glance.example.com");
    expect(glanceBaseUrl("https://example.com/glance/")).toBe("https://example.com/glance");
  });

  it("allows http only on this machine, for development", () => {
    expect(glanceBaseUrl("http://localhost:8080")).toBe("http://localhost:8080");
    expect(glanceBaseUrl("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
    expect(glanceBaseUrl("http://glance.example.com")).toBeNull();
  });

  it("hides the feature when switched off or mistyped", () => {
    expect(glanceBaseUrl("off")).toBeNull();
    expect(glanceBaseUrl("OFF")).toBeNull();
    expect(glanceBaseUrl("not a url")).toBeNull();
    expect(glanceBaseUrl("javascript:alert(1)")).toBeNull();
    expect(glanceJoinUrl(event, "Jordan", null)).toBeNull();
  });
});

describe("the Join with Glance link", () => {
  it("opens Glance's join page with the event and the person's name", () => {
    const url = glanceJoinUrl(event, "Jordan Lee", GLANCE_DEFAULT_URL)!;
    expect(url.startsWith("https://glancear.vercel.app/#/join?")).toBe(true);
    expect(Object.fromEntries(query(url))).toEqual({
      source: "metaintros", id: "ev-indie-guild", title: "Indie Night: Local Bands Showcase", place: "The Guild Theatre", name: "Jordan Lee",
    });
  });

  it("is the same for everyone at an event apart from their name", () => {
    const a = query(glanceJoinUrl(event, "Jordan", GLANCE_DEFAULT_URL)!), b = query(glanceJoinUrl(event, "Sam", GLANCE_DEFAULT_URL)!);
    a.delete("name"); b.delete("name");
    expect(a.toString()).toBe(b.toString());
  });

  it("survives punctuation and leaves out what is missing", () => {
    const url = glanceJoinUrl({ id: "ev-1", title: "Rock & Roll: 50% off? #1", venueName: null }, "", GLANCE_DEFAULT_URL)!;
    const read = query(url);
    expect(read.get("title")).toBe("Rock & Roll: 50% off? #1");
    expect(read.has("place")).toBe(false);
    expect(read.has("name")).toBe(false);
  });

  it("cuts text to what Glance accepts", () => {
    const read = query(glanceJoinUrl({ id: "ev-1", title: "t".repeat(300), venueName: "v".repeat(300) }, "n".repeat(300), GLANCE_DEFAULT_URL)!);
    expect(read.get("title")!.length).toBe(100);
    expect(read.get("place")!.length).toBe(160);
    expect(read.get("name")!.length).toBe(80);
  });

  it("makes no link for an event Glance could not key", () => {
    expect(glanceJoinUrl({ id: "has space", title: "X" }, null, GLANCE_DEFAULT_URL)).toBeNull();
    expect(glanceJoinUrl({ id: "e".repeat(65), title: "X" }, null, GLANCE_DEFAULT_URL)).toBeNull();
    expect(glanceJoinUrl({ id: "ev-1", title: "   " }, null, GLANCE_DEFAULT_URL)).toBeNull();
  });
});
