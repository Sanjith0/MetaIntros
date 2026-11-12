// Seeded world for the demo. All people, events and venues are fictional.
import type { FbEvent, Landmark, Profile, Venue } from "@/lib/types";

export const ME = "maya";
export const DEMO_EVENT = "pale-hour";

export const LANDMARKS: Landmark[] = [
  { id: "soco", name: "South Congress", lat: 30.2500, lng: -97.7497 },
  { id: "ut", name: "UT Campus", lat: 30.2849, lng: -97.7341 },
  { id: "east6", name: "East 6th", lat: 30.2640, lng: -97.7290 },
  { id: "zilker", name: "Zilker", lat: 30.2669, lng: -97.7729 },
  { id: "domain", name: "The Domain", lat: 30.4021, lng: -97.7253 },
];

export const EVENTS: FbEvent[] = [
  {
    id: "pale-hour",
    title: "Pale Hour — Live on Red River",
    host: "Austin Indie Music Fans",
    venueName: "The Lantern Room, Red River St",
    date: "2026-11-14",
    startTime: "20:00",
    lat: 30.2700,
    lng: -97.7361,
    tags: ["Indie", "Live music", "18+"],
    goingCount: 212,
    interestedCount: 1430,
    cover: "linear-gradient(135deg,#ff7a59 0%,#c2185b 45%,#3b1c6e 100%)",
    description:
      "Dreamy indie-folk four-piece Pale Hour plays their first Austin show. Doors 7:30, music 8:00. Fans of Phoebe Bridgers, Mitski and boygenius — this one's for you.",
  },
  {
    id: "watch-party",
    title: "Longhorns Rivalry Watch Party",
    host: "UT Austin Alumni — Young Grads",
    venueName: "Bluebonnet Beer Garden",
    date: "2026-11-14",
    startTime: "18:30",
    lat: 30.2766,
    lng: -97.7365,
    tags: ["Sports", "Outdoor", "Free"],
    goingCount: 540,
    interestedCount: 2210,
    cover: "linear-gradient(135deg,#bf5700 0%,#7a3300 100%)",
    description: "Giant screens, burnt-orange everything. Bring your loudest voice.",
  },
  {
    id: "sunset-run",
    title: "Sunset Run Club + Tacos",
    host: "Austin Run Club",
    venueName: "Zilker Park Great Lawn",
    date: "2026-11-15",
    startTime: "17:30",
    lat: 30.2669,
    lng: -97.7729,
    tags: ["Fitness", "Outdoor", "Beginner friendly"],
    goingCount: 88,
    interestedCount: 410,
    cover: "linear-gradient(135deg,#00b4a0 0%,#1e6fd9 100%)",
    description: "Easy 5K loop around the lake, then tacos. All paces welcome.",
  },
];

export const VENUES: Venue[] = [
  { id: "v-bluebonnet", name: "Bluebonnet Coffee Co.", kind: "coffee", noise: "quiet", price: 1, opensUntil: "21:00", lat: 30.2689, lng: -97.7392, blurb: "Big tables, matcha on tap, 6 min walk to Red River." },
  { id: "v-lantern-tea", name: "Lantern Tea House", kind: "coffee", noise: "quiet", price: 2, opensUntil: "20:00", lat: 30.2668, lng: -97.7420, blurb: "Bubble tea and board games." },
  { id: "v-taqueria", name: "Red River Taqueria", kind: "food", noise: "medium", price: 1, opensUntil: "23:00", lat: 30.2694, lng: -97.7366, blurb: "Cheap tacos, patio seating, 2 min from the venue." },
  { id: "v-noodle", name: "Rainey Noodle Bar", kind: "food", noise: "medium", price: 2, opensUntil: "22:00", lat: 30.2585, lng: -97.7385, blurb: "Ramen counter, fast service." },
  { id: "v-neon", name: "Neon Arcade Bar", kind: "bar", noise: "loud", price: 2, opensUntil: "02:00", lat: 30.2672, lng: -97.7360, blurb: "Pinball and pitchers. Very loud after 7." },
  { id: "v-rooftop", name: "Sixth St Rooftop", kind: "bar", noise: "loud", price: 3, opensUntil: "02:00", lat: 30.2671, lng: -97.7395, blurb: "Cocktails with a view, $14 drinks." },
  { id: "v-waterloo", name: "Waterloo Park Lawn", kind: "park", noise: "quiet", price: 1, opensUntil: "22:00", lat: 30.2745, lng: -97.7363, blurb: "Open lawn, string lights, free." },
  { id: "v-pizza", name: "Congress Ave Pizza", kind: "food", noise: "medium", price: 1, opensUntil: "23:00", lat: 30.2650, lng: -97.7431, blurb: "Slices the size of your face." },
];

type P = Omit<Profile, "lat" | "lng" | "hue"> & { at: string; jitter: [number, number] };

const near = (lmId: string, [dx, dy]: [number, number]) => {
  const lm = LANDMARKS.find((l) => l.id === lmId)!;
  return { lat: +(lm.lat + dx * 0.004).toFixed(5), lng: +(lm.lng + dy * 0.004).toFixed(5) };
};

const hand: P[] = [
  {
    id: "maya", name: "Maya", lastName: "Chen", age: 22, gender: "woman", pronouns: "she/her",
    hometown: "San Jose, CA", school: "UC Davis", work: "Product designer at a fintech startup",
    bio: "New to Austin (3 weeks!). Will trade matcha recs for climbing gym recs.",
    likes: ["Phoebe Bridgers", "Mitski", "boygenius", "Studio Ghibli", "Matcha", "Bouldering", "Stardew Valley", "Thrifting", "The Bear"],
    dislikes: ["Clubbing", "Loud bars"],
    groups: ["Austin New in Town", "Austin Indie Music Fans", "Bouldering ATX", "UC Davis Alumni"],
    pastEvents: ["Cal Hacks 11", "boygenius at the Greek Theatre", "Davis Picnic Day 2025"],
    friends: ["Sam Okafor", "Lena Park", "Dev Patel", "Rosa Jimenez"],
    vibe: "chill", budget: 1, freeFrom: "17:30", at: "soco", jitter: [0, 0],
  },
  {
    id: "priya", name: "Priya", lastName: "Raman", age: 23, gender: "woman", pronouns: "she/her",
    hometown: "Fremont, CA", school: "UC Berkeley", work: "Software engineer, Austin",
    bio: "Climbing V4s badly. Cries at every Ghibli movie.",
    likes: ["Phoebe Bridgers", "Mitski", "Matcha", "Bouldering", "Studio Ghibli", "Wordle"],
    dislikes: ["Clubbing"],
    groups: ["Austin Indie Music Fans", "Bouldering ATX", "Women in Tech Austin"],
    pastEvents: ["Cal Hacks 11", "Austin City Limits 2025"],
    friends: ["Sam Okafor", "Arjun Mehta"],
    vibe: "chill", budget: 1, freeFrom: "17:30", at: "soco", jitter: [0.4, -0.3],
  },
  {
    id: "jordan", name: "Jordan", lastName: "Reyes", age: 24, gender: "woman", pronouns: "she/her",
    hometown: "Houston, TX", school: "Texas State", work: "Bartender & DJ",
    bio: "Here for the encore and the afterparty.",
    likes: ["Phoebe Bridgers", "Mitski", "boygenius", "Clubbing", "Tequila", "Thrifting"],
    dislikes: ["Coffee shops", "Early nights"],
    groups: ["Austin Indie Music Fans", "ATX Nightlife"],
    pastEvents: ["boygenius at the Greek Theatre", "SXSW 2026"],
    friends: ["Marco Ruiz"],
    vibe: "loud", budget: 3, freeFrom: "19:30", at: "soco", jitter: [-0.3, 0.5],
  },
  {
    id: "sofia", name: "Sofia", lastName: "Alvarez", age: 21, gender: "woman", pronouns: "she/her",
    hometown: "El Paso, TX", school: "UT Austin", work: "Senior, Radio-TV-Film",
    bio: "Shooting everything on a 1998 point-and-shoot.",
    likes: ["boygenius", "Thrifting", "The Bear", "Tacos", "Film photography"],
    dislikes: ["Sports bars"],
    groups: ["Austin New in Town", "ATX Thrift Swap"],
    pastEvents: ["ATX Thrift Swap Fall 2026"],
    friends: ["Rosa Jimenez"],
    vibe: "chill", budget: 1, freeFrom: "17:00", at: "soco", jitter: [0.2, 0.6],
  },
  {
    id: "hannah", name: "Hannah", lastName: "Kim", age: 24, gender: "woman", pronouns: "she/her",
    hometown: "Irvine, CA", school: "UCLA", work: "UX researcher",
    bio: "Board game evangelist. Will teach you Wingspan.",
    likes: ["Mitski", "Stardew Valley", "Matcha", "Board games", "Studio Ghibli"],
    dislikes: ["Loud bars"],
    groups: ["Austin Board Game Night", "Austin Indie Music Fans", "Austin New in Town"],
    pastEvents: ["Austin Board Game Night #41"],
    friends: ["Lena Park"],
    vibe: "chill", budget: 2, freeFrom: "18:00", at: "soco", jitter: [-0.5, -0.2],
  },
  {
    id: "aisha", name: "Aisha", lastName: "Bello", age: 22, gender: "woman", pronouns: "she/her",
    hometown: "Dallas, TX", school: "Rice", work: "Data analyst",
    bio: "Run club Tuesdays, climbing Thursdays, concerts whenever.",
    likes: ["Phoebe Bridgers", "Bouldering", "Studio Ghibli", "Running", "Matcha"],
    dislikes: [],
    groups: ["Bouldering ATX", "Austin Run Club", "Austin Indie Music Fans"],
    pastEvents: ["Austin City Limits 2025", "Sunset Run Club #12"],
    friends: ["Dev Patel"],
    vibe: "social", budget: 1, freeFrom: "18:00", at: "soco", jitter: [0.6, 0.1],
  },
  {
    id: "lily", name: "Lily", lastName: "Tran", age: 23, gender: "woman", pronouns: "she/her",
    hometown: "Garland, TX", school: "UT Dallas", work: "Pastry chef",
    bio: "I will judge your croissant. Lovingly.",
    likes: ["The Bear", "Thrifting", "Film photography", "Matcha", "Taylor Swift"],
    dislikes: [],
    groups: ["ATX Thrift Swap", "Austin New in Town"],
    pastEvents: ["ATX Thrift Swap Fall 2026"],
    friends: [],
    vibe: "social", budget: 2, freeFrom: "17:30", at: "soco", jitter: [-0.1, -0.6],
  },
  {
    id: "marcus", name: "Marcus", lastName: "Lee", age: 23, gender: "man", pronouns: "he/him",
    hometown: "Seattle, WA", school: "University of Washington", work: "Game developer",
    bio: "Making a cozy farming game. Yes, like Stardew.",
    likes: ["Mitski", "Stardew Valley", "Bouldering", "Ramen", "Studio Ghibli"],
    dislikes: ["Clubbing"],
    groups: ["Bouldering ATX", "ATX Gamers"],
    pastEvents: ["PAX West 2025"],
    friends: ["Arjun Mehta"],
    vibe: "chill", budget: 1, freeFrom: "18:00", at: "soco", jitter: [0.3, 0.3],
  },
  {
    id: "diego", name: "Diego", lastName: "Fuentes", age: 25, gender: "man", pronouns: "he/him",
    hometown: "San Antonio, TX", school: "UTSA", work: "Line cook",
    bio: "Watched The Bear and quit my desk job. No regrets.",
    likes: ["boygenius", "Tacos", "The Bear", "Cooking"],
    dislikes: [],
    groups: ["Austin New in Town"],
    pastEvents: [],
    friends: ["Marco Ruiz"],
    vibe: "social", budget: 2, freeFrom: "18:00", at: "soco", jitter: [-0.6, 0.4],
  },
  {
    id: "ethan", name: "Ethan", lastName: "Brooks", age: 26, gender: "man", pronouns: "he/him",
    hometown: "Lubbock, TX", school: "Texas Tech", work: "Sales",
    bio: "Football Saturdays are sacred.",
    likes: ["Football", "Craft beer", "Country music"],
    dislikes: ["Indie music"],
    groups: ["UT Austin Alumni — Young Grads"],
    pastEvents: ["Longhorns Opener 2026"],
    friends: [],
    vibe: "loud", budget: 2, freeFrom: "19:00", at: "soco", jitter: [0.5, -0.6],
  },
  {
    id: "noor", name: "Noor", lastName: "Haddad", age: 22, gender: "nonbinary", pronouns: "they/them",
    hometown: "Dearborn, MI", school: "University of Michigan", work: "Illustrator",
    bio: "I make zines about bugs. Ask me about moths.",
    likes: ["Phoebe Bridgers", "Zines", "Thrifting", "Studio Ghibli", "Matcha"],
    dislikes: ["Loud bars"],
    groups: ["Austin Indie Music Fans", "ATX Zine Fest", "Austin New in Town"],
    pastEvents: ["ATX Zine Fest 2026"],
    friends: ["Lena Park"],
    vibe: "chill", budget: 1, freeFrom: "18:00", at: "soco", jitter: [-0.2, 0.2],
  },
  {
    id: "chloe", name: "Chloe", lastName: "Martin", age: 29, gender: "woman", pronouns: "she/her",
    hometown: "Atlanta, GA", school: "Georgia Tech", work: "Consultant",
    bio: "Wine, pilates, repeat.",
    likes: ["Wine", "Pilates", "Taylor Swift"],
    dislikes: [],
    groups: ["Austin Young Professionals"],
    pastEvents: [],
    friends: [],
    vibe: "social", budget: 3, freeFrom: "18:30", at: "soco", jitter: [0.1, -0.4],
  },
  {
    id: "ben", name: "Ben", lastName: "Carter", age: 21, gender: "man", pronouns: "he/him",
    hometown: "Austin, TX", school: "UT Austin", work: "Student",
    bio: "EDM > everything.",
    likes: ["EDM", "Clubbing", "Energy drinks"],
    dislikes: ["Coffee shops"],
    groups: ["ATX Nightlife"],
    pastEvents: ["EDC 2025"],
    friends: [],
    vibe: "loud", budget: 2, freeFrom: "20:00", at: "soco", jitter: [-0.4, -0.5],
  },
  {
    id: "grace", name: "Grace", lastName: "Liu", age: 22, gender: "woman", pronouns: "she/her",
    hometown: "Sacramento, CA", school: "UC Davis", work: "Nurse",
    bio: "Crocheting a frog for everyone I meet.",
    likes: ["Matcha", "Mitski", "Crochet", "Studio Ghibli", "Phoebe Bridgers"],
    dislikes: ["Clubbing"],
    groups: ["Austin New in Town", "Austin Crochet Circle", "UC Davis Alumni"],
    pastEvents: ["Davis Picnic Day 2025"],
    friends: ["Rosa Jimenez"],
    vibe: "chill", budget: 1, freeFrom: "17:30", at: "soco", jitter: [0.7, -0.1],
  },
  {
    id: "tyler", name: "Tyler", lastName: "Nguyen", age: 24, gender: "man", pronouns: "he/him",
    hometown: "Houston, TX", school: "University of Houston", work: "Firmware engineer",
    bio: "Immortal 2 in Valorant, Bronze 2 in small talk.",
    likes: ["Valorant", "Phoebe Bridgers", "Ramen", "Bouldering"],
    dislikes: ["Clubbing"],
    groups: ["Bouldering ATX", "ATX Gamers"],
    pastEvents: ["HackTX 2025"],
    friends: ["Dev Patel"],
    vibe: "chill", budget: 1, freeFrom: "18:00", at: "soco", jitter: [-0.7, 0.0],
  },
];

// Procedural extras in other buckets so the queue map isn't empty.
const FIRST = ["Ava", "Leo", "Zoe", "Kai", "Mia", "Omar", "Ivy", "Raj", "Nia", "Sam", "Eli", "Rin", "Jade", "Luca", "Tess", "Amir", "Cleo", "Finn", "Maya", "Theo"];
const LAST = ["Park", "Diaz", "Wong", "Shah", "Cole", "Ortiz", "Reed", "Kaur", "Moss", "Hale"];
const LIKE_POOL = ["Phoebe Bridgers", "Mitski", "Tacos", "Running", "Valorant", "Football", "Matcha", "Thrifting", "EDM", "Board games", "Studio Ghibli", "Craft beer", "Bouldering", "Taylor Swift", "Ramen"];
const GROUP_POOL = ["Austin New in Town", "Austin Run Club", "ATX Gamers", "Austin Indie Music Fans", "UT Austin Alumni — Young Grads", "ATX Thrift Swap"];
const BUCKETS = ["ut", "east6", "zilker", "domain"];
const VIBES = ["chill", "social", "loud"] as const;

const extras: P[] = Array.from({ length: 24 }, (_, i) => {
  const pick = <T,>(arr: readonly T[], k: number) => arr[(i * 7 + k * 3) % arr.length];
  return {
    id: `x${i}`,
    name: FIRST[i % FIRST.length] === "Maya" ? "Mara" : FIRST[i % FIRST.length],
    lastName: LAST[i % LAST.length],
    age: 19 + (i % 9),
    gender: (["woman", "man", "nonbinary", "woman", "man"] as const)[i % 5],
    pronouns: (["she/her", "he/him", "they/them", "she/her", "he/him"])[i % 5],
    hometown: "Austin, TX",
    school: "UT Austin",
    work: "—",
    bio: "",
    likes: [pick(LIKE_POOL, 0), pick(LIKE_POOL, 1), pick(LIKE_POOL, 2)],
    dislikes: [],
    groups: [pick(GROUP_POOL, 0), pick(GROUP_POOL, 1)],
    pastEvents: [],
    friends: [],
    vibe: VIBES[i % 3],
    budget: ((i % 3) + 1) as 1 | 2 | 3,
    freeFrom: ["17:00", "18:00", "19:00"][i % 3],
    at: BUCKETS[i % BUCKETS.length],
    jitter: [((i * 13) % 10) / 10 - 0.5, ((i * 7) % 10) / 10 - 0.5],
  };
});

export const PROFILES: Profile[] = [...hand, ...extras].map(({ at, jitter, ...p }, i) => ({
  ...p,
  ...near(at, jitter),
  hue: (i * 47) % 360,
}));

export const profileById = (id: string) => PROFILES.find((p) => p.id === id);

/** People already queued for the demo event before Maya joins (by id). */
export const PREQUEUED = ["priya", "ethan", "lily", "x0", "x4", "x9"];
/** People who join while Maya waits (demo fill), in order. */
export const LATE_JOINERS = ["jordan", "hannah", "ben", "aisha", "marcus", "noor", "chloe", "sofia", "diego", "grace", "tyler", "x2", "x7"];
