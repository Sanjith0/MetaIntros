import type { Fact, Profile } from "@/contracts";
import { TOPICS } from "./topics";

/* All people here are fictional. Avatars are coloured initials, never photos. */

const fact = (ownerId: string, n: number, tag: string, text: string, ask: string, approved = true): Fact => ({
  id: `${ownerId}-f${n}`,
  ownerId,
  tag,
  text,
  ask,
  approved,
  source: "profile",
});

const fromTopics = (ownerId: string, tags: string[]): Fact[] =>
  tags.map((t, i) => {
    const topic = TOPICS[t];
    if (!topic) throw new Error(`unknown topic ${t}`);
    return fact(ownerId, i + 1, t, topic.text, topic.ask);
  });

/* ------------------------------------------------------------------ */
/* The demo party                                                      */
/* ------------------------------------------------------------------ */

export const DEMO_IDS = ["maya", "dev", "ana", "kai", "zoe"] as const;

const DEMO: Profile[] = [
  {
    id: "maya",
    name: "Maya Okafor",
    firstName: "Maya",
    age: 27,
    gender: "woman",
    pronouns: "she/her",
    city: "San Francisco",
    homeLandmark: "Dolores Park",
    avatarHue: 12,
    facts: [
      fact("maya", 1, "film photography", "Shoots film on an old point-and-shoot", "What are you shooting on lately?"),
      fact("maya", 2, "bouldering", "Started bouldering this year", "Which gym do you climb at?"),
      fact("maya", 3, "farmers market", "Never misses the Sunday farmers market", "What's worth buying at the market right now?"),
      fact("maya", 4, "portuguese", "Learning Portuguese before a trip to Lisbon", "How's the Portuguese going?"),
      // Written by Maya but not approved for sharing. Must never reach anyone.
      fact("maya", 5, "new in town", "Moved here after a hard year", "How are you settling in?", false),
    ],
    settings: { womenOnly: false, notOnlyWoman: true },
    blocks: [],
    groupIds: ["grp-portuguese", "grp-sf-nightlife"],
  },
  {
    id: "dev",
    name: "Dev Raman",
    firstName: "Dev",
    age: 29,
    gender: "man",
    pronouns: "he/him",
    city: "San Francisco",
    homeLandmark: "Dolores Park",
    avatarHue: 210,
    facts: [
      fact("dev", 1, "film photography", "Develops his own black-and-white film", "What's the last roll you developed?"),
      fact("dev", 2, "hot sauce", "Makes small batches of hot sauce", "What's in your latest batch?"),
      fact("dev", 3, "pickup basketball", "Plays pickup basketball on Tuesdays", "Where do you usually play?"),
      fact("dev", 4, "farmers market", "Shops the Sunday market for chilies", "What's worth buying at the market right now?"),
    ],
    settings: { womenOnly: false, notOnlyWoman: false },
    blocks: [],
    groupIds: ["grp-sf-nightlife"],
  },
  {
    id: "ana",
    name: "Ana Lucero",
    firstName: "Ana",
    age: 31,
    gender: "woman",
    pronouns: "she/her",
    city: "San Francisco",
    homeLandmark: "Dolores Park",
    avatarHue: 145,
    facts: [
      fact("ana", 1, "bouldering", "Boulders three times a week", "What's your project right now?"),
      fact("ana", 2, "ceramics", "Throws pots at a shared studio", "What are you making at the studio?"),
      fact("ana", 3, "farmers market", "Runs a flower stall at the Sunday market some weeks", "Which stall should I visit first?"),
      fact("ana", 4, "hot sauce", "Collects hot sauces from every trip", "What's the best one you've found?"),
    ],
    settings: { womenOnly: false, notOnlyWoman: false },
    blocks: [],
    groupIds: ["grp-ceramics", "grp-bouldering", "grp-sf-nightlife"],
  },
  {
    id: "kai",
    name: "Kai Morgan",
    firstName: "Kai",
    age: 26,
    gender: "nonbinary",
    pronouns: "they/them",
    city: "San Francisco",
    homeLandmark: "Dolores Park",
    avatarHue: 275,
    facts: [
      fact("kai", 1, "bouldering", "Sets routes at a climbing gym", "Which route are you proudest of?"),
      fact("kai", 2, "synths", "Builds music on old synths", "What are you working on musically?"),
      fact("kai", 3, "hot sauce", "Grows chilies on a fire escape", "Which chili grows best out there?"),
      fact("kai", 4, "board games", "Designs small card games", "What's the game you're designing about?"),
    ],
    settings: { womenOnly: false, notOnlyWoman: false },
    blocks: [],
    groupIds: ["grp-bouldering", "grp-sf-nightlife"],
  },
  {
    id: "zoe",
    name: "Zoe Lindqvist",
    firstName: "Zoe",
    age: 28,
    gender: "woman",
    pronouns: "she/her",
    city: "San Francisco",
    homeLandmark: "Dolores Park",
    avatarHue: 330,
    facts: [
      fact("zoe", 1, "portuguese", "Grew up speaking Portuguese at home", "Any phrase every visitor should know?"),
      fact("zoe", 2, "ceramics", "Glazes pottery on weekends", "What glaze are you into right now?"),
      fact("zoe", 3, "board games", "Hosts a monthly board game night", "What's the best game you've played this year?"),
      fact("zoe", 4, "film photography", "Carries a disposable camera to every party", "Got any good shots lately?"),
    ],
    settings: { womenOnly: false, notOnlyWoman: false },
    blocks: [],
    groupIds: ["grp-ceramics", "grp-portuguese", "grp-sf-nightlife"],
  },
];

/* ------------------------------------------------------------------ */
/* Background profiles (35)                                            */
/* ------------------------------------------------------------------ */

type Row = [
  id: string,
  name: string,
  age: number,
  gender: Profile["gender"],
  pronouns: string,
  landmark: string,
  hue: number,
  tags: string[],
  groups: string[],
  opts?: Partial<Pick<Profile, "settings" | "blocks">>,
];

const ROWS: Row[] = [
  ["priya", "Priya Natarajan", 30, "woman", "she/her", "Dolores Park", 25, ["running", "cooking"], ["grp-sf-nightlife"]],
  ["theo", "Theo Barros", 33, "man", "he/him", "Dolores Park", 190, ["live jazz", "cycling"], ["grp-sf-nightlife"]],
  ["lena", "Lena Fischer", 17, "woman", "she/her", "Dolores Park", 55, ["indie games", "hiking"], []],
  ["rosa", "Rosa Delgado", 25, "woman", "she/her", "Dolores Park", 0, ["ceramics", "podcasts"], ["grp-ceramics"], { settings: { womenOnly: true, notOnlyWoman: false } }],
  ["nina", "Nina Petrova", 29, "woman", "she/her", "Dolores Park", 300, ["trivia nights", "sci-fi books"], ["grp-bouldering"], { settings: { womenOnly: false, notOnlyWoman: true } }],
  ["omar", "Omar Haddad", 32, "man", "he/him", "Dolores Park", 160, ["cooking", "hot sauce"], ["grp-bouldering"], { blocks: ["ana"] }],
  ["sam", "Sam Whitfield", 35, "man", "he/him", "Dolores Park", 95, ["podcasts", "running"], ["grp-sf-nightlife"]],
  ["jules", "Jules Moreau", 27, "nonbinary", "they/them", "Ferry Building", 240, ["live jazz", "sci-fi books"], ["grp-jazz"]],
  ["hana", "Hana Sato", 24, "woman", "she/her", "Ferry Building", 340, ["farmers market", "cooking"], ["grp-jazz"]],
  ["marcus", "Marcus Reed", 34, "man", "he/him", "Ferry Building", 30, ["cycling", "running"], ["grp-cyclists"]],
  ["ivy", "Ivy Chen", 26, "woman", "she/her", "Ferry Building", 120, ["podcasts", "trivia nights"], ["grp-jazz"]],
  ["leo", "Leo Santos", 28, "man", "he/him", "Ferry Building", 200, ["portuguese", "language exchange"], ["grp-portuguese"]],
  ["amara", "Amara Obi", 30, "woman", "she/her", "Ferry Building", 15, ["hiking", "gardening"], ["grp-cyclists"]],
  ["felix", "Felix Wagner", 31, "man", "he/him", "Ferry Building", 260, ["board games", "indie games"], ["grp-board-games"]],
  ["sofia", "Sofia Rossi", 29, "woman", "she/her", "Golden Gate Park", 350, ["gardening", "hiking"], ["grp-gardeners"]],
  ["ben", "Ben Adler", 36, "man", "he/him", "Golden Gate Park", 45, ["cycling", "podcasts"], ["grp-cyclists"]],
  ["mei", "Mei Tanaka", 27, "woman", "she/her", "Golden Gate Park", 320, ["ceramics", "film photography"], ["grp-ceramics"]],
  ["rafa", "Rafa Ortiz", 30, "man", "he/him", "Golden Gate Park", 20, ["pickup basketball", "cooking"], ["grp-sf-nightlife"]],
  ["quinn", "Quinn Avery", 25, "nonbinary", "they/them", "Golden Gate Park", 180, ["synths", "indie games"], ["grp-board-games"]],
  ["elena", "Elena Vasquez", 33, "woman", "she/her", "Golden Gate Park", 5, ["language exchange", "running"], ["grp-portuguese"]],
  ["tom", "Tom Gallagher", 38, "man", "he/him", "Golden Gate Park", 70, ["trivia nights", "live jazz"], ["grp-jazz"]],
  ["aisha", "Aisha Karim", 26, "woman", "she/her", "Lake Merritt", 290, ["running", "podcasts"], ["grp-runners"]],
  ["noah", "Noah Kim", 29, "man", "he/him", "Lake Merritt", 220, ["indie games", "board games"], ["grp-board-games"]],
  ["grace", "Grace Mensah", 31, "woman", "she/her", "Lake Merritt", 40, ["gardening", "cooking"], ["grp-gardeners"]],
  ["luca", "Luca Bianchi", 28, "man", "he/him", "Lake Merritt", 105, ["cycling", "film photography"], ["grp-cyclists"]],
  ["tara", "Tara Singh", 24, "woman", "she/her", "Lake Merritt", 310, ["hiking", "sci-fi books"], ["grp-runners"]],
  ["owen", "Owen Price", 35, "man", "he/him", "Lake Merritt", 150, ["live jazz", "synths"], ["grp-jazz"]],
  ["yara", "Yara Haddad", 27, "woman", "she/her", "Lake Merritt", 280, ["language exchange", "portuguese"], ["grp-portuguese"]],
  ["eli", "Eli Brooks", 30, "man", "he/him", "Union Square", 230, ["trivia nights", "pickup basketball"], ["grp-sf-nightlife"]],
  ["chloe", "Chloe Martin", 26, "woman", "she/her", "Union Square", 345, ["podcasts", "ceramics"], ["grp-ceramics"]],
  ["ravi", "Ravi Iyer", 32, "man", "he/him", "Union Square", 35, ["cooking", "hot sauce"], ["grp-sf-nightlife"]],
  ["mira", "Mira Novak", 29, "woman", "she/her", "Union Square", 265, ["sci-fi books", "board games"], ["grp-board-games"]],
  ["dante", "Dante Russo", 27, "man", "he/him", "Union Square", 10, ["running", "cycling"], ["grp-runners"]],
  ["june", "June Park", 25, "woman", "she/her", "Union Square", 170, ["film photography", "hiking"], ["grp-sf-nightlife"]],
  ["alex", "Alex Rivera", 30, "nonbinary", "they/them", "Union Square", 200, ["indie games", "synths"], ["grp-board-games"]],
];

const BACKGROUND: Profile[] = ROWS.map(([id, name, age, gender, pronouns, landmark, hue, tags, groups, opts]) => ({
  id,
  name,
  firstName: name.split(" ")[0]!,
  age,
  gender,
  pronouns,
  city: landmark === "Lake Merritt" ? "Oakland" : "San Francisco",
  homeLandmark: landmark,
  avatarHue: hue,
  facts: fromTopics(id, tags),
  settings: opts?.settings ?? { womenOnly: false, notOnlyWoman: false },
  blocks: opts?.blocks ?? [],
  groupIds: groups,
}));

export const PROFILES: Profile[] = [...DEMO, ...BACKGROUND];
