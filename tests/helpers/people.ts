import { MockGraphSource } from "@/lib/graph/source";
import { buildTasteProfile } from "@/lib/profile/builder";
import type { Person } from "@/lib/profile/load";
import { ageBandFor, normalizePair } from "@/lib/domain/enums";
import { ageFromBirthday, genderFromGraph } from "@/lib/graph/schema";
import BLOCKS from "@/data/seed/blocks.json";

/** Build Person objects straight from mock-graph files (no DB) for fast pure tests. */
export function loadPeopleFromFiles(now = new Date(2026, 10, 12)): Map<string, Person> {
  const src = new MockGraphSource();
  const out = new Map<string, Person>();
  for (const id of src.listUserIds()) {
    const g = src.getUser(id);
    out.set(id, {
      id,
      name: g.name,
      ageBand: ageBandFor(ageFromBirthday(g.birthday, now)),
      gender: genderFromGraph(g.gender),
      womenOnlyParty: g.x_preferences.women_only_party,
      homeLat: g.location.latitude,
      homeLng: g.location.longitude,
      isSimulated: id !== "p01",
      isLive: false,
      avatarColor: g.picture.data.color,
      profile: buildTasteProfile(g),
      friends: new Set(g.friends.data.map((f) => f.id)),
      blocked: new Set(),
    });
  }
  for (const b of BLOCKS) {
    out.get(b.blockerId)!.blocked.add(b.blockedId);
    out.get(b.blockedId)!.blocked.add(b.blockerId);
  }
  void normalizePair;
  return out;
}

export const clusterOf = (id: string) => new MockGraphSource().getUser(id).x_cluster;
