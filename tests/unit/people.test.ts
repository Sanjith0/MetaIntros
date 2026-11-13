import { describe, expect, it } from "vitest";
import { generateAll, PEOPLE } from "@/lib/seed/generate";
import { isSensitiveText } from "@/lib/cards/claims";
import { GENDERED } from "@/lib/companion/brief";
import { personaFrom } from "@/lib/profile/persona";

describe("seeded people", () => {
  const { users } = generateAll();

  it("are distinct people: unique first and last names, each with an intro, work, hometown and personality", () => {
    expect(new Set(users.map((u) => u.first_name)).size).toBe(users.length);
    expect(new Set(users.map((u) => u.last_name)).size).toBe(users.length);
    for (const u of users) {
      const p = personaFrom(u);
      expect(p.about, u.id).toBeTruthy();
      expect(p.work, u.id).toBeTruthy();
      expect(p.hometown, u.id).toBeTruthy();
      expect(p.traits.length, u.id).toBe(3);
      expect(p.voice, u.id).toMatch(new RegExp(`^${u.first_name}\\b`));
    }
  });

  it("keep the demo cast's names", () => {
    const name = (id: string) => users.find((u) => u.id === id)!.name;
    expect([name("p01"), name("p02"), name("p03"), name("p04"), name("p05"), name("p45")]).toEqual(["Jordan Lee", "Freya Rossi", "Zoe Kim", "Reza Ali", "Yuki Dubois", "Ari Moreau"]);
  });

  it("never put a sensitive topic or a guessed gender in profile text", () => {
    for (const [id, p] of Object.entries(PEOPLE)) {
      for (const t of [p.about, p.work, p.hometown, p.voice, ...p.traits]) expect(isSensitiveText(t), `${id}: ${t}`).toBe(false);
      expect(GENDERED.test(p.voice), `${id}: ${p.voice}`).toBe(false);
    }
  });
});
