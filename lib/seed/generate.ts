/**
 * Deterministic synthetic-persona generator. Produces Graph-API-shaped user payloads,
 * plus seed chats, RSVPs and blocks. Run via `pnpm gen:personas`; output is committed.
 */
import { VOCAB_BY_TAG, type VocabEntry } from "@/lib/graph/vocabulary";
import type { AvailabilityBlock, GraphUser } from "@/lib/graph/schema";
import EVENTS_JSON from "@/data/seed/events.json";
import PEOPLE_JSON from "@/data/seed/people.json";
import { hashString, mulberry32, pick, randInt, sample, type Rng } from "@/lib/rng";

export const ME_ID = "p01";
export const GEN_YEAR = 2026;

interface ClusterDef {
  id: string;
  size: number;
  core: string[];
  extras: string[];
  dislikePool: string[];
  ages: [number, number];
  avail: AvailabilityBlock[];
  musicTags: string[];
}

export const CLUSTERS: ClusterDef[] = [
  {
    id: "indie-climb", size: 15, core: ["climbing", "bouldering", "indie-music", "live-music", "vinyl"],
    extras: ["coffee", "film", "thrifting", "hiking", "photography"], dislikePool: ["edm", "clubbing", "crowded-bars", "early-mornings", "basketball"],
    ages: [19, 24], musicTags: ["indie-music"],
    avail: [{ day: "fri", start: "18:00", end: "24:00" }, { day: "sat", start: "10:00", end: "24:00" }, { day: "sun", start: "12:00", end: "20:00" }],
  },
  {
    id: "games-anime", size: 12, core: ["board-games", "anime", "ttrpg", "video-games", "manga"],
    extras: ["trivia", "ramen", "karaoke", "chess", "film"], dislikePool: ["early-mornings", "running", "crowded-bars", "loud-venues", "hiking"],
    ages: [18, 26], musicTags: ["edm", "jazz"],
    avail: [{ day: "fri", start: "18:00", end: "24:00" }, { day: "sat", start: "13:00", end: "24:00" }, { day: "sun", start: "13:00", end: "22:00" }],
  },
  {
    id: "run-coffee", size: 12, core: ["running", "run-club", "coffee", "marathons", "cycling"],
    extras: ["yoga", "farmers-markets", "podcasts", "hiking", "dogs"], dislikePool: ["late-nights", "clubbing", "video-games", "crowded-bars", "horror-movies"],
    ages: [22, 30], musicTags: ["indie-music", "jazz"],
    avail: [{ day: "sat", start: "07:00", end: "14:00" }, { day: "sun", start: "07:00", end: "13:00" }, { day: "tue", start: "18:00", end: "21:00" }],
  },
  {
    id: "hike-photo", size: 11, core: ["hiking", "photography", "camping", "nature", "birding"],
    extras: ["coffee", "cycling", "art", "cooking", "dogs"], dislikePool: ["clubbing", "loud-venues", "late-nights", "video-games", "crowded-bars"],
    ages: [23, 30], musicTags: ["indie-music", "jazz"],
    avail: [{ day: "sat", start: "07:00", end: "18:00" }, { day: "sun", start: "07:00", end: "18:00" }],
  },
  {
    id: "builders", size: 11, core: ["startups", "hackathons", "ai", "tech-talks", "product-design"],
    extras: ["chess", "coffee", "podcasts", "books", "pickleball"], dislikePool: ["crowded-bars", "horror-movies", "karaoke", "clubbing", "early-mornings"],
    ages: [20, 28], musicTags: ["edm", "indie-music"],
    avail: [{ day: "fri", start: "17:00", end: "23:00" }, { day: "sat", start: "09:00", end: "14:00" }, { day: "sun", start: "14:00", end: "20:00" }],
  },
  {
    id: "food", size: 11, core: ["food", "farmers-markets", "cooking", "ramen", "baking"],
    extras: ["thrifting", "film", "karaoke", "art", "coffee"], dislikePool: ["early-mornings", "running", "video-games", "loud-venues", "camping"],
    ages: [23, 30], musicTags: ["jazz", "indie-music"],
    avail: [{ day: "sat", start: "09:00", end: "16:00" }, { day: "sun", start: "10:00", end: "16:00" }, { day: "thu", start: "18:00", end: "22:00" }],
  },
];
export const BRIDGE_COUNT = 8; // total = 72 + 8 = 80

const AREAS = [
  { name: "Menlo Park, California", lat: 37.453, lng: -122.182 },
  { name: "Palo Alto, California", lat: 37.444, lng: -122.16 },
  { name: "Stanford, California", lat: 37.427, lng: -122.17 },
  { name: "Redwood City, California", lat: 37.485, lng: -122.236 },
];

const FIRST_W = ["Maya", "Priya", "Sofia", "Emma", "Aisha", "Hana", "Chloe", "Zoe", "Lena", "Nadia", "Ava", "Mei", "Isabel", "Grace", "Leila", "Rosa", "Tara", "Nina", "Julia", "Yuki", "Amara", "Sara", "Ines", "Kiara", "Elena", "Fatima", "Lucy", "Noor", "Camila", "Ruby", "Anika", "Freya", "Jade", "Mira", "Valeria", "Hazel", "Ivy", "Lily", "Rina", "Daniela"];
const FIRST_M = ["Ethan", "Arjun", "Diego", "Noah", "Kenji", "Omar", "Lucas", "Mateo", "Ben", "Ravi", "Leo", "Sam", "Daniel", "Marcus", "Theo", "Ivan", "Jonah", "Kai", "Andre", "Felix", "Hugo", "Tomás", "Nikhil", "Owen", "Elijah", "Malik", "Rafael", "Wes", "Jin", "Caleb", "Aaron", "Dev", "Gabe", "Isaac", "Luis", "Milo", "Nate", "Oscar", "Reza", "Simon"];
const FIRST_NB = ["River", "Avery", "Rowan", "Sage", "Quinn", "Ari", "Emerson", "Remy"];
const LAST = ["Chen", "Patel", "Garcia", "Kim", "Nguyen", "Okafor", "Silva", "Cohen", "Tanaka", "Haddad", "Müller", "Rossi", "Kowalski", "Singh", "Martinez", "Johnson", "Park", "Ali", "Lopez", "Wong", "Novak", "Ibrahim", "Sato", "Reyes", "Brooks", "Shah", "Andersen", "Moreau", "Costa", "Yamamoto", "Hughes", "Mensah", "Dubois", "Rahman", "Ortiz", "Bauer", "Ferreira", "Lindqvist", "Adeyemi", "Castillo"];
/** Hand-written fictional people, one per persona id. Names here replace the random draw. */
export interface PersonSheet {
  gender: "female" | "male" | "custom";
  first: string;
  last: string;
  about: string;
  work: string;
  hometown: string;
  traits: string[];
  voice: string;
}
export const PEOPLE = PEOPLE_JSON as Record<string, PersonSheet>;

const COLORS = ["#1877f2", "#e41e3f", "#f7b928", "#45bd62", "#7c3aed", "#f02849", "#2abba7", "#ff6f00", "#8b5cf6", "#0ea5e9", "#d946ef", "#14b8a6"];

export interface GeneratedSeed {
  users: GraphUser[];
  chats: SeedChat[];
  rsvps: { eventId: string; userId: string; status: "interested" | "going" }[];
  blocks: { blockerId: string; blockedId: string }[];
}
export interface SeedChat {
  id: string;
  type: "direct" | "group";
  title: string | null;
  memberIds: string[];
  /** minutes before seed time */
  messages: { senderId: string; body: string; minutesAgo: number }[];
  /** Me has read up to this many minutes ago (unread = messages newer than this) */
  meReadMinutesAgo: number;
}

const page = (rng: Rng, uid: string, v: VocabEntry, i: number) => ({
  id: `pg_${hashString(v.pages[i % v.pages.length])}`,
  name: v.pages[i % v.pages.length],
  category: v.category,
  created_time: `20${randInt(rng, 19, 25)}-0${randInt(rng, 1, 9)}-1${randInt(rng, 0, 9)}T12:00:00+0000`,
});

function jitterBlock(rng: Rng, b: AvailabilityBlock): AvailabilityBlock {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  let s = toMin(b.start) + pick(rng, [-60, 0, 0, 0, 60]);
  let e = toMin(b.end) + pick(rng, [-60, 0, 0, 0]);
  s = Math.max(0, s);
  e = Math.min(1440, e);
  if (e - s < 120) e = Math.min(1440, s + 180);
  return { day: b.day, start: fmt(s), end: fmt(e) };
}

interface Draft {
  id: string;
  cluster: string;
  first: string;
  last: string;
  gender: "female" | "male" | "custom";
  age: number;
  area: (typeof AREAS)[number];
  likeTags: string[];
  dislikeTags: string[];
  musicTags: string[];
  avail: AvailabilityBlock[];
  womenOnly: boolean;
  sensitiveTag?: string;
}

export function generateAll(seed = 20261113): GeneratedSeed {
  const rng = mulberry32(seed);
  const drafts: Draft[] = [];
  const usedNames = new Set<string>();
  let idx = 1;

  const nameFor = (gender: Draft["gender"]): [string, string] => {
    for (;;) {
      const pool = gender === "female" ? FIRST_W : gender === "male" ? FIRST_M : FIRST_NB;
      const f = pick(rng, pool);
      const l = pick(rng, LAST);
      if (!usedNames.has(`${f} ${l}`)) {
        usedNames.add(`${f} ${l}`);
        return [f, l];
      }
    }
  };
  const genderRoll = (): Draft["gender"] => {
    const r = rng();
    return r < 0.5 ? "female" : r < 0.93 ? "male" : "custom";
  };

  for (const c of CLUSTERS) {
    for (let k = 0; k < c.size; k++) {
      const id = `p${String(idx++).padStart(2, "0")}`;
      const isMe = id === ME_ID;
      const gender: Draft["gender"] = isMe ? "custom" : genderRoll();
      const [first, last] = isMe ? ["Jordan", "Lee"] : nameFor(gender);
      if (isMe) usedNames.add("Jordan Lee");
      const coreN = isMe ? 5 : randInt(rng, 3, 5);
      const core = isMe ? c.core : sample(rng, c.core, coreN);
      const extras = sample(rng, c.extras, randInt(rng, 1, 3));
      const crossCluster = rng() < 0.4 ? [pick(rng, pick(rng, CLUSTERS.filter((o) => o !== c)).core)] : [];
      const likeTags = [...new Set([...core, ...extras, ...crossCluster])];
      const dislikeTags = sample(rng, c.dislikePool, randInt(rng, 1, 2)).filter((t) => !likeTags.includes(t));
      const age = isMe ? 23 : randInt(rng, c.ages[0], c.ages[1]);
      const avail = (isMe ? c.avail : c.avail.filter((_, i) => i === 0 || rng() > 0.15)).map((b) => (isMe ? b : jitterBlock(rng, b)));
      drafts.push({
        id, cluster: c.id, first, last, gender, age,
        area: isMe ? AREAS[1] : pick(rng, AREAS),
        likeTags, dislikeTags, musicTags: sample(rng, c.musicTags, 1), avail,
        womenOnly: gender === "female" && (c.id === "run-coffee" || c.id === "hike-photo") && rng() < 0.45,
      });
    }
  }

  // Bridge / noise personas. The first two are deliberate "nightlife" outliers whose
  // dislikes collide with the indie-climb core (used by cohesion tests).
  for (let k = 0; k < BRIDGE_COUNT; k++) {
    const id = `p${String(idx++).padStart(2, "0")}`;
    const gender = genderRoll();
    const [first, last] = nameFor(gender);
    const outlier = k < 2;
    const [a, b] = sample(rng, CLUSTERS, 2);
    const likeTags = outlier
      ? ["edm", "clubbing", "late-nights", "basketball", "crowded-bars"]
      : [...new Set([...sample(rng, a.core, 2), ...sample(rng, b.core, 2), pick(rng, ["karaoke", "basketball", "pickleball", "dogs", "volunteering", "jazz"])])];
    const dislikeTags = outlier ? ["indie-music", "climbing", "early-mornings"] : sample(rng, ["horror-movies", "loud-venues", "early-mornings"], 1);
    drafts.push({
      id, cluster: outlier ? "outlier-nightlife" : "bridge", first, last, gender,
      age: outlier ? randInt(rng, 20, 24) : randInt(rng, 19, 29),
      area: pick(rng, AREAS), likeTags, dislikeTags,
      musicTags: outlier ? ["edm"] : ["jazz"],
      avail: outlier ? [{ day: "fri", start: "20:00", end: "24:00" }, { day: "sat", start: "20:00", end: "24:00" }] : [jitterBlock(rng, a.avail[0]), jitterBlock(rng, b.avail[0])],
      womenOnly: false,
    });
  }

  // Every persona is a hand-written person (data/seed/people.json). The random name draw above still
  // runs so the RNG stream, and with it every like, friend and RSVP, stays exactly as it was.
  for (const d of drafts) {
    const p = PEOPLE[d.id];
    if (!p) throw new Error(`data/seed/people.json has no entry for ${d.id}`);
    if (p.gender !== d.gender) throw new Error(`data/seed/people.json: ${d.id} is ${d.gender}, not ${p.gender}`);
    d.first = p.first;
    d.last = p.last;
  }

  // Plant sensitive likes on 8 personas (2 in indie-climb so the demo party exercises the filter).
  const sensitiveTags = ["sensitive-politics", "sensitive-religion", "sensitive-health", "sensitive-sexuality"];
  const plant = ["p03", "p06", "p18", "p25", "p33", "p41", "p52", "p60"];
  plant.forEach((pid, i) => {
    const d = drafts.find((x) => x.id === pid)!;
    d.sensitiveTag = sensitiveTags[i % sensitiveTags.length];
  });

  // ── Friend graph ──
  const friends = new Map<string, Set<string>>(drafts.map((d) => [d.id, new Set()]));
  const link = (a: string, b: string) => {
    if (a === b) return;
    friends.get(a)!.add(b);
    friends.get(b)!.add(a);
  };
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const a = drafts[i], b = drafts[j];
      if (a.id === ME_ID || b.id === ME_ID) continue; // Me's friends are hand-picked below
      const same = a.cluster === b.cluster;
      if (rng() < (same ? 0.3 : 0.03)) link(a.id, b.id);
    }
  }
  // Me: two friends inside indie-climb (they bridge mutuals to the rest of the cluster),
  // a handful elsewhere. Most of Me's future squad will be strangers with mutuals.
  const meFriends = ["p02", "p04", "p20", "p30", "p45", "p50", "p66", "p75"];
  meFriends.forEach((f) => link(ME_ID, f));
  // Make sure Me's two indie friends know most of the cluster → plausible mutual friends.
  for (const d of drafts.filter((x) => x.cluster === "indie-climb" && x.id !== ME_ID)) {
    if (rng() < 0.6) link("p02", d.id);
    if (rng() < 0.5) link("p04", d.id);
  }
  for (const d of drafts) {
    if (friends.get(d.id)!.size === 0) {
      const mate = drafts.find((x) => x.cluster === d.cluster && x.id !== d.id && x.id !== ME_ID)!;
      link(d.id, mate.id);
    }
  }

  const byId = new Map(drafts.map((d) => [d.id, d]));
  const nameOf = (id: string) => `${byId.get(id)!.first} ${byId.get(id)!.last}`;

  const users: GraphUser[] = drafts.map((d) => {
    const prng = mulberry32(hashString(d.id));
    const likeEntries = d.likeTags.flatMap((t) => {
      const v = VOCAB_BY_TAG.get(t)!;
      const n = Math.min(v.pages.length, randInt(prng, 1, 2));
      return Array.from({ length: n }, (_, i) => page(prng, d.id, v, i + randInt(prng, 0, 2)));
    });
    if (d.sensitiveTag) likeEntries.push(page(prng, d.id, VOCAB_BY_TAG.get(d.sensitiveTag)!, randInt(prng, 0, 3)));
    const uniqLikes = [...new Map(likeEntries.map((l) => [l.name, l])).values()];

    const groupTags = sample(prng, d.likeTags.filter((t) => VOCAB_BY_TAG.get(t)!.groups?.length), 3);
    if (d.sensitiveTag && prng() < 0.7) groupTags.push(d.sensitiveTag);
    const groups = groupTags.map((t) => {
      const g = pick(prng, VOCAB_BY_TAG.get(t)!.groups!);
      return { id: `gr_${hashString(g)}`, name: g, privacy: "OPEN" as const };
    });

    const music = d.musicTags.flatMap((t) =>
      sample(prng, VOCAB_BY_TAG.get(t)!.artists ?? [], randInt(prng, 2, 3)).map((a) => ({
        id: `pg_${hashString(a)}`, name: a, category: "Musician/Band",
      })),
    );

    const evTags = sample(prng, d.likeTags.filter((t) => VOCAB_BY_TAG.get(t)!.events?.length), randInt(prng, 2, 4));
    const events = evTags.map((t, i) => {
      const e = pick(prng, VOCAB_BY_TAG.get(t)!.events!);
      return {
        id: `ev_${hashString(e)}`, name: e,
        start_time: `${GEN_YEAR - (i % 2)}-0${randInt(prng, 1, 9)}-${10 + randInt(prng, 0, 18)}T19:00:00-0700`,
        rsvp_status: "attending" as const,
      };
    });

    const notInterested = d.dislikeTags.map((t) => page(prng, d.id, VOCAB_BY_TAG.get(t)!, 0));
    const fl = [...friends.get(d.id)!].sort();
    const by = GEN_YEAR - d.age - (prng() < 0.5 ? 1 : 0);
    const jitter = () => (prng() - 0.5) * 0.024;

    return {
      id: d.id,
      name: `${d.first} ${d.last}`,
      first_name: d.first,
      last_name: d.last,
      birthday: `${String(randInt(prng, 1, 12)).padStart(2, "0")}/${String(randInt(prng, 1, 28)).padStart(2, "0")}/${by}`,
      gender: d.gender,
      location: { name: d.area.name, latitude: +(d.area.lat + jitter()).toFixed(5), longitude: +(d.area.lng + jitter()).toFixed(5) },
      picture: { data: { color: COLORS[hashString(d.id) % COLORS.length] } },
      likes: { data: uniqLikes, paging: { cursors: { before: "QVFIUjA", after: "QVFIUjE" } } },
      groups: { data: groups },
      music: { data: music },
      events: { data: events },
      friends: { data: fl.map((id) => ({ id, name: nameOf(id) })), summary: { total_count: fl.length } },
      x_not_interested: { data: notInterested },
      x_availability: { data: d.avail },
      x_preferences: { women_only_party: d.womenOnly },
      about: PEOPLE[d.id].about,
      x_profile: { work: PEOPLE[d.id].work, hometown: PEOPLE[d.id].hometown, traits: PEOPLE[d.id].traits, voice: PEOPLE[d.id].voice },
      x_cluster: d.cluster,
    };
  });

  // Fix birthdays so the computed age (as of Nov 2026) matches the draft age exactly.
  for (const u of users) {
    const d = byId.get(u.id)!;
    const [, dd] = u.birthday.split("/");
    u.birthday = `06/${dd}/${GEN_YEAR - d.age}`;
  }

  // ── RSVPs: personas mark "interested" in events matching their likes ──
  const events = EVENTS_JSON as { id: string; tags: string[] }[];
  const rsvps: GeneratedSeed["rsvps"] = [];
  for (const d of drafts) {
    if (d.id === ME_ID) continue;
    for (const ev of events) {
      const overlap = ev.tags.filter((t) => d.likeTags.includes(t)).length;
      if (overlap > 0 && rng() < 0.25 + 0.15 * overlap) {
        rsvps.push({ eventId: ev.id, userId: d.id, status: rng() < 0.3 ? "going" : "interested" });
      }
    }
  }

  // ── Blocks ──
  const blocks = [
    { blockerId: ME_ID, blockedId: "p09" }, // Me has blocked someone in their own cluster
    { blockerId: "p17", blockedId: "p19" },
    { blockerId: "p40", blockedId: "p44" },
  ];

  const chats = buildChats(rng, [...friends.get(ME_ID)!].sort(), nameOf);
  return { users, chats, rsvps, blocks };
}

function buildChats(rng: Rng, meFriends: string[], nameOf: (id: string) => string): SeedChat[] {
  const lines = [
    "are you going this weekend?", "lol yes", "that was so fun", "send me the pics!", "omw", "running 5 late sorry",
    "did you see that new place on University?", "we should get dinner soon", "happy birthday!!", "haha classic",
    "can you send me that link", "ok sounds good", "I'm so tired today", "wait really?", "brb", "lmk when you're free",
    "that's hilarious", "ok I'm in", "who's driving?", "thanks again for last night",
  ];
  const chats: SeedChat[] = [];
  let minutes = 7;
  meFriends.forEach((fid, i) => {
    const n = randInt(rng, 3, 7);
    const msgs = Array.from({ length: n }, (_, k) => ({
      senderId: k % 2 === 0 ? fid : ME_ID,
      body: pick(rng, lines),
      minutesAgo: minutes + (n - k) * randInt(rng, 2, 30),
    }));
    msgs.sort((a, b) => b.minutesAgo - a.minutesAgo);
    const lastAgo = msgs[msgs.length - 1].minutesAgo;
    chats.push({
      id: `chat-dm-${fid}`, type: "direct", title: null, memberIds: [ME_ID, fid], messages: msgs,
      meReadMinutesAgo: i % 3 === 0 ? lastAgo + 1 : lastAgo, // every third DM has an unread message
    });
    minutes += randInt(rng, 25, 400);
  });
  const groupDefs = [
    { title: "Roommates 🏠", members: meFriends.slice(0, 3) },
    { title: "Climbing crew", members: ["p02", "p04"] },
    { title: "Fam", members: meFriends.slice(4, 7) },
    { title: "Hackathon team", members: [meFriends[3], meFriends[5]] },
  ];
  groupDefs.forEach((g, i) => {
    const members = [ME_ID, ...g.members];
    const n = randInt(rng, 4, 8);
    const msgs = Array.from({ length: n }, (_, k) => ({
      senderId: members[k % members.length],
      body: pick(rng, lines),
      minutesAgo: 30 + i * 180 + (n - k) * randInt(rng, 3, 40),
    }));
    msgs.sort((a, b) => b.minutesAgo - a.minutesAgo);
    const lastAgo = msgs[msgs.length - 1].minutesAgo;
    chats.push({
      id: `chat-group-${i + 1}`, type: "group", title: g.title, memberIds: members, messages: msgs,
      meReadMinutesAgo: i === 0 ? lastAgo + 60 : lastAgo,
    });
  });
  void nameOf;
  return chats;
}
