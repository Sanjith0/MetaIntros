/**
 * Shared interest vocabulary. Graph API data contains page/group/artist/event *names*;
 * the profile builder maps those names back to normalized tags via this table.
 * Live sign-up chips are generated from the same table, so live users and personas
 * land in the same feature space.
 */

export type SensitiveCategory = "politics" | "religion" | "health" | "sexuality";

export interface VocabEntry {
  tag: string;
  label: string;
  /** Facebook page category */
  category: string;
  pages: string[];
  groups?: string[];
  events?: string[];
  artists?: string[];
  /** If set, this entry must never be surfaced in talk cards and is excluded from matching. */
  sensitive?: SensitiveCategory;
  /** Shown as a chip in live sign-up */
  chip?: boolean;
}

export const VOCAB: VocabEntry[] = [
  // ── indie + climbing ──
  { tag: "climbing", label: "Climbing", category: "Sports & Recreation", chip: true,
    pages: ["Peninsula Boulders", "Bay Area Climbers Coalition", "Climbing Magazine"],
    groups: ["Bay Area Climbers", "Stanford Climbing Club Alumni"],
    events: ["Bouldering Night at Peninsula Boulders", "Castle Rock Outdoor Climb Day"] },
  { tag: "bouldering", label: "Bouldering", category: "Sports & Recreation",
    pages: ["Bouldering Daily", "V-Scale Memes"],
    groups: ["Peninsula Bouldering Crew"],
    events: ["Peninsula Bouldering League"] },
  { tag: "indie-music", label: "Indie music", category: "Musician/Band", chip: true,
    pages: ["Pitchfork", "KEXP", "Indie Shuffle"],
    groups: ["Bay Area Indie Shows"],
    events: ["Indie Night at The Guild", "Phoebe Bridgers @ Greek Theatre"],
    artists: ["Phoebe Bridgers", "Japanese Breakfast", "Alvvays", "Mitski", "boygenius", "Wet Leg", "Snail Mail"] },
  { tag: "live-music", label: "Live music", category: "Arts & Entertainment", chip: true,
    pages: ["Bay Area Concerts", "SF Live Music Guide"],
    groups: ["Peninsula Gig Buddies"],
    events: ["Outside Lands", "Stern Grove Festival"] },
  { tag: "vinyl", label: "Vinyl records", category: "Shopping & Retail",
    pages: ["Rasputin Music", "Vinyl Me, Please"],
    groups: ["Peninsula Vinyl Collectors"],
    events: ["Record Store Day Palo Alto"] },
  { tag: "thrifting", label: "Thrifting", category: "Shopping & Retail", chip: true,
    pages: ["Goodwill Silicon Valley", "Thrift Flip Club"],
    groups: ["Bay Area Thrift Finds"] },
  { tag: "film", label: "Film", category: "Movie", chip: true,
    pages: ["A24", "Criterion Collection", "Letterboxd"],
    groups: ["Peninsula Film Club"],
    events: ["Stanford Theatre Classic Double Feature"] },

  // ── board games + anime ──
  { tag: "board-games", label: "Board games", category: "Games/Toys", chip: true,
    pages: ["Catan", "Wingspan", "Board Game Geek"],
    groups: ["Palo Alto Board Gamers", "Peninsula Tabletop Meetup"],
    events: ["Board Game Night at Meeple House", "Wingspan Tournament"] },
  { tag: "anime", label: "Anime", category: "TV Show", chip: true,
    pages: ["Studio Ghibli", "Crunchyroll", "Jujutsu Kaisen", "Frieren"],
    groups: ["Bay Area Anime Watch Party"],
    events: ["Anime Expo Watch Party", "Ghibli Fest Screening"] },
  { tag: "manga", label: "Manga", category: "Book",
    pages: ["One Piece", "Chainsaw Man", "VIZ Media"],
    groups: ["Manga Swap Peninsula"] },
  { tag: "ttrpg", label: "D&D / TTRPGs", category: "Games/Toys", chip: true,
    pages: ["Dungeons & Dragons", "Critical Role", "Dimension 20"],
    groups: ["Peninsula D&D Players"],
    events: ["D&D Adventurers League Night"] },
  { tag: "video-games", label: "Video games", category: "Games/Toys", chip: true,
    pages: ["Nintendo", "Valorant", "Stardew Valley", "Hades"],
    groups: ["Bay Area Gamers"],
    events: ["Smash Bros Local Tournament"] },
  { tag: "trivia", label: "Trivia", category: "Games/Toys", chip: true,
    pages: ["Geeks Who Drink", "Jeopardy!"],
    groups: ["Peninsula Trivia Teams"],
    events: ["Trivia Night at Cal Ave"] },
  { tag: "chess", label: "Chess", category: "Games/Toys",
    pages: ["Chess.com", "GothamChess"],
    groups: ["Palo Alto Chess Club"] },

  // ── run club + coffee ──
  { tag: "running", label: "Running", category: "Sports & Recreation", chip: true,
    pages: ["Strava", "Runner's World", "Hoka"],
    groups: ["Palo Alto Runners"],
    events: ["Palo Alto Moonlight Run", "Run Wild Half Marathon"] },
  { tag: "run-club", label: "Run clubs", category: "Sports & Recreation",
    pages: ["Stanford Oval Run Club", "November Project SF"],
    groups: ["Saturday Morning Run Crew"],
    events: ["Saturday 5K Social Run"] },
  { tag: "coffee", label: "Coffee", category: "Coffee Shop", chip: true,
    pages: ["Blue Bottle Coffee", "Verve Coffee Roasters", "Philz Coffee"],
    groups: ["Peninsula Coffee Nerds"],
    events: ["Latte Art Throwdown"] },
  { tag: "marathons", label: "Marathons", category: "Sports & Recreation",
    pages: ["California International Marathon", "Boston Marathon"],
    events: ["SF Marathon"] },
  { tag: "cycling", label: "Cycling", category: "Sports & Recreation", chip: true,
    pages: ["Rapha", "Bay Area Bicycle Coalition"],
    groups: ["Peninsula Weekend Riders"],
    events: ["Old La Honda Hill Climb"] },
  { tag: "yoga", label: "Yoga", category: "Health/Beauty", chip: true,
    pages: ["Yoga With Adriene", "CorePower Yoga"],
    groups: ["Sunset Yoga Palo Alto"],
    events: ["Yoga on the Oval"] },
  { tag: "podcasts", label: "Podcasts", category: "Media",
    pages: ["Hard Fork", "Radiolab", "Huberman Lab"] },

  // ── hiking + photography ──
  { tag: "hiking", label: "Hiking", category: "Outdoor & Sporting Goods", chip: true,
    pages: ["AllTrails", "REI", "Bay Area Hiker"],
    groups: ["Peninsula Hikers", "Bay Area Hiking Buddies"],
    events: ["Windy Hill Sunset Hike", "Mission Peak Sunrise Hike"] },
  { tag: "photography", label: "Photography", category: "Arts & Entertainment", chip: true,
    pages: ["Fujifilm X", "35mm Film Photography", "Unsplash"],
    groups: ["Bay Area Photo Walks"],
    events: ["Golden Gate Photo Walk"] },
  { tag: "camping", label: "Camping", category: "Outdoor & Sporting Goods",
    pages: ["Recreation.gov", "Big Basin Redwoods"],
    groups: ["Bay Area Campers"],
    events: ["Big Sur Camping Trip"] },
  { tag: "nature", label: "Nature & parks", category: "Nonprofit Organization", chip: true,
    pages: ["Midpeninsula Open Space", "National Park Service"],
    groups: ["Baylands Nature Lovers"],
    events: ["Baylands Cleanup Day"] },
  { tag: "birding", label: "Birding", category: "Nonprofit Organization",
    pages: ["Audubon Society", "Merlin Bird ID"],
    groups: ["Santa Clara Valley Birders"] },
  { tag: "art", label: "Art & museums", category: "Museum", chip: true,
    pages: ["Cantor Arts Center", "SFMOMA"],
    groups: ["Peninsula Sketch Club"],
    events: ["Cantor Arts Center Late Night"] },

  // ── startups + tech ──
  { tag: "startups", label: "Startups", category: "Business", chip: true,
    pages: ["Y Combinator", "TechCrunch", "Lenny's Newsletter"],
    groups: ["Palo Alto Founders", "Stanford Startup Network"],
    events: ["Founder Friday Palo Alto", "YC Demo Day Watch Party"] },
  { tag: "hackathons", label: "Hackathons", category: "Science, Technology & Engineering", chip: true,
    pages: ["Devpost", "Major League Hacking"],
    groups: ["Bay Area Hackers"],
    events: ["TreeHacks", "CalHacks"] },
  { tag: "ai", label: "AI", category: "Science, Technology & Engineering", chip: true,
    pages: ["Hugging Face", "Two Minute Papers", "Latent Space"],
    groups: ["Peninsula AI Builders"],
    events: ["AI Tinkerers Meetup"] },
  { tag: "tech-talks", label: "Tech talks", category: "Science, Technology & Engineering",
    pages: ["Hacker News", "Stanford Online"],
    groups: ["Tech Talks Palo Alto"],
    events: ["Stanford HAI Public Lecture"] },
  { tag: "product-design", label: "Product design", category: "Design",
    pages: ["Figma", "Dribbble"],
    groups: ["Bay Area Product Designers"],
    events: ["Design Crit Night"] },
  { tag: "books", label: "Books", category: "Book", chip: true,
    pages: ["Goodreads", "Kepler's Books"],
    groups: ["Menlo Park Book Club"],
    events: ["Kepler's Author Talk"] },

  // ── food ──
  { tag: "food", label: "Trying new food", category: "Restaurant", chip: true,
    pages: ["Eater SF", "The Infatuation", "Bon Appétit"],
    groups: ["Peninsula Foodies"],
    events: ["Off the Grid Food Trucks"] },
  { tag: "farmers-markets", label: "Farmers markets", category: "Farmers Market", chip: true,
    pages: ["Palo Alto Farmers Market", "CUESA"],
    groups: ["Peninsula Market Mornings"],
    events: ["Ferry Building Market Morning"] },
  { tag: "cooking", label: "Cooking", category: "Food & Beverage", chip: true,
    pages: ["Serious Eats", "Joshua Weissman", "NYT Cooking"],
    groups: ["Home Cooks of the Peninsula"],
    events: ["Pasta-Making Class"] },
  { tag: "ramen", label: "Ramen", category: "Restaurant",
    pages: ["Ramen Nagi", "Ramen Hunter"],
    groups: ["Bay Area Ramen Club"],
    events: ["Ramen Crawl San Mateo"] },
  { tag: "baking", label: "Baking", category: "Food & Beverage",
    pages: ["Tartine Bakery", "King Arthur Baking"],
    groups: ["Sourdough Starters Peninsula"] },

  // ── misc / bridge ──
  { tag: "karaoke", label: "Karaoke", category: "Arts & Entertainment", chip: true,
    pages: ["Sing Sing Karaoke", "Smule"],
    events: ["Karaoke Night Mountain View"] },
  { tag: "jazz", label: "Jazz", category: "Musician/Band",
    pages: ["SFJAZZ", "Blue Note Records"],
    events: ["Jazz on the Plaza"],
    artists: ["Kamasi Washington", "Robert Glasper", "Norah Jones"] },
  { tag: "edm", label: "EDM", category: "Musician/Band", chip: true,
    pages: ["Insomniac Events", "Electric Daisy Carnival"],
    events: ["EDC Las Vegas"],
    artists: ["Fred again..", "Illenium", "Zedd", "Disclosure"] },
  { tag: "clubbing", label: "Clubbing", category: "Nightlife",
    pages: ["Audio SF", "Temple Nightclub"],
    events: ["Warehouse Rave SF"] },
  { tag: "late-nights", label: "Late nights", category: "Nightlife",
    pages: ["Late Night Eats SF"] },
  { tag: "crowded-bars", label: "Crowded bars", category: "Bar",
    pages: ["Rose & Crown Pub", "Nola Palo Alto"] },
  { tag: "basketball", label: "Basketball", category: "Sports Team", chip: true,
    pages: ["Golden State Warriors", "NBA"],
    groups: ["Warriors Fans Bay Area"],
    events: ["Warriors Watch Party"] },
  { tag: "pickleball", label: "Pickleball", category: "Sports & Recreation", chip: true,
    pages: ["USA Pickleball", "Pickleball Kitchen"],
    groups: ["Palo Alto Pickleball"] },
  { tag: "early-mornings", label: "Early mornings", category: "Lifestyle",
    pages: ["5AM Club"] },
  { tag: "horror-movies", label: "Horror movies", category: "Movie",
    pages: ["Blumhouse", "Shudder"] },
  { tag: "loud-venues", label: "Loud venues", category: "Nightlife",
    pages: ["Concert Subwoofer Fans"] },
  { tag: "dogs", label: "Dogs", category: "Pet", chip: true,
    pages: ["Dogspotting", "Peninsula Humane Society"],
    groups: ["Palo Alto Dog Park Friends"] },
  { tag: "volunteering", label: "Volunteering", category: "Nonprofit Organization", chip: true,
    pages: ["Second Harvest of Silicon Valley", "VolunteerMatch"],
    groups: ["Peninsula Volunteers"],
    events: ["Second Harvest Food Sort"] },

  // ── sensitive (planted so the privacy filter has real data to strip) ──
  { tag: "sensitive-politics", label: "Political org", category: "Political Organization", sensitive: "politics",
    pages: ["Young Democrats of Santa Clara County", "Peninsula Young Republicans"],
    groups: ["Palo Alto Policy Debate Circle"] },
  { tag: "sensitive-religion", label: "Religious org", category: "Religious Organization", sensitive: "religion",
    pages: ["Stanford Catholic Community", "Hillel at Stanford", "Peninsula Bible Fellowship"],
    groups: ["Muslim Students Association Alumni"] },
  { tag: "sensitive-health", label: "Health support", category: "Health/Medical", sensitive: "health",
    pages: ["Anxiety Support Circle Bay Area", "Type 1 Diabetes Community"],
    groups: ["ADHD Adults Peninsula"] },
  { tag: "sensitive-sexuality", label: "Identity group", category: "Community Organization", sensitive: "sexuality",
    pages: ["Peninsula Pride Network"],
    groups: ["LGBTQ+ Book Club Palo Alto"] },
];

export const VOCAB_BY_TAG: ReadonlyMap<string, VocabEntry> = new Map(VOCAB.map((v) => [v.tag, v]));

type Kind = "page" | "group" | "event" | "artist";
const NAME_INDEX = new Map<string, { tag: string; kind: Kind }>();
for (const v of VOCAB) {
  for (const p of v.pages) NAME_INDEX.set(p.toLowerCase(), { tag: v.tag, kind: "page" });
  for (const g of v.groups ?? []) NAME_INDEX.set(g.toLowerCase(), { tag: v.tag, kind: "group" });
  for (const e of v.events ?? []) NAME_INDEX.set(e.toLowerCase(), { tag: v.tag, kind: "event" });
  for (const a of v.artists ?? []) NAME_INDEX.set(a.toLowerCase(), { tag: v.tag, kind: "artist" });
}

/** Map a Graph page/group/event/artist name to its normalized tag. */
export function tagForName(name: string): string | undefined {
  return NAME_INDEX.get(name.toLowerCase())?.tag;
}

export function isSensitiveTag(tag: string): boolean {
  return Boolean(VOCAB_BY_TAG.get(tag)?.sensitive);
}

export const SIGNUP_CHIPS = VOCAB.filter((v) => v.chip && !v.sensitive).map((v) => ({ tag: v.tag, label: v.label }));
