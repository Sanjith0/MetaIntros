/**
 * Prompts for the seeded photos in public/images, generated once by scripts/gen-images.ts with Muse's
 * image model and committed, so the app stays offline-first. Keys are paths under public/images.
 * These stand in for photos people would post; they show no real person, venue branding or logo.
 */

export type Shape = "cover" | "photo" | "story" | "square";

/** Output size per shape: covers are 2:1 like the pattern covers they replace, stories 9:16. */
export const SHAPES: Record<Shape, { width: number; height: number; request: string }> = {
  cover: { width: 1200, height: 600, request: "1536x1024" },
  photo: { width: 1200, height: 900, request: "1536x1024" },
  story: { width: 540, height: 960, request: "1024x1536" },
  square: { width: 256, height: 256, request: "1024x1024" },
};

/** Shared look: warm, candid, a little film grain. Homey, not stock. */
export const STYLE =
  "Candid documentary photograph, warm natural light, shot on 35mm film with soft grain, relaxed and inviting, " +
  "people seen mid-distance or from behind, nobody posing for the camera. No text, no signs with words, no logos, no watermark.";

export const PROMPTS: Record<string, { shape: Shape; prompt: string }> = {
  // Event covers (one per seeded event in data/seed/events.json)
  "covers/ev-indie-guild.webp": { shape: "cover", prompt: "A small indie band playing on the stage of an old ornate theatre, warm amber stage lights, the crowd seen from behind with a few hands raised." },
  "covers/ev-boulder-social.webp": { shape: "cover", prompt: "A friendly bouldering gym with colourful holds on angled walls, beginners laughing on thick crash pads, a coach pointing at the wall, chalk dust in the light." },
  "covers/ev-vinyl-swap.webp": { shape: "cover", prompt: "Crates of vinyl records on folding tables in a sunny outdoor plaza, hands flipping through records, a turntable on a table nearby, afternoon light." },
  "covers/ev-board-game-night.webp": { shape: "cover", prompt: "Friends playing a board game at a café table, a wall of game boxes on shelves behind them, warm lamps, snacks and mugs on the table." },
  "covers/ev-ghibli-screening.webp": { shape: "cover", prompt: "An outdoor movie night on a big grass field at dusk, people on picnic blankets seen from behind, a large glowing blank screen with soft pastel sky colours, string lights." },
  "covers/ev-dnd-oneshot.webp": { shape: "cover", prompt: "A tabletop role-playing game at a library table, colourful dice, character sheets, pencils and a few painted miniatures, friends leaning in and laughing, warm lamp light." },
  "covers/ev-run-club.webp": { shape: "cover", prompt: "A small group of runners jogging at an easy chatting pace along a tree-lined campus path in soft morning light." },
  "covers/ev-coffee-crawl.webp": { shape: "cover", prompt: "A tasting flight of small specialty coffees on a wooden café counter, latte art, friends chatting in the background, morning window light." },
  "covers/ev-trail-run.webp": { shape: "cover", prompt: "Trail runners on a dirt path over golden rolling California hills dotted with oak trees at sunrise, long shadows." },
  "covers/ev-photo-walk.webp": { shape: "cover", prompt: "People with cameras and phones photographing a lake at golden hour along a paved shoreline path, warm backlight." },
  "covers/ev-baylands-birding.webp": { shape: "cover", prompt: "A wooden boardwalk through a tidal marsh, a great egret in the reeds, two people with binoculars and sketchbooks, soft overcast light." },
  "covers/ev-ai-build-night.webp": { shape: "cover", prompt: "A library meeting room at night, laptops open on a long table, sticky notes on a whiteboard, a small team collaborating, pizza boxes, warm overhead light." },
  "covers/ev-founders-coffee.webp": { shape: "cover", prompt: "A cosy neighbourhood café with a blue painted door, two people talking over coffee and an open notebook by the window, Saturday morning light." },
  "covers/ev-design-crit.webp": { shape: "cover", prompt: "People pinning printed app screen designs to a wall, colourful sticky notes, a small friendly group discussing, bright library room." },
  "covers/ev-farmers-market.webp": { shape: "cover", prompt: "Farmers market stalls overflowing with fresh produce and flowers, people tasting samples, sunny morning, canvas canopies." },
  "covers/ev-ramen-crawl.webp": { shape: "cover", prompt: "Steaming bowls of ramen on a wooden counter, friends lifting noodles with chopsticks, warm restaurant light." },
  "covers/ev-dumpling-class.webp": { shape: "cover", prompt: "Hands folding dumplings on a floured wooden table in a community kitchen, trays of pleated dumplings, friendly cooking class." },
  "covers/ev-movies-square.webp": { shape: "cover", prompt: "An outdoor movie night in a small town square, people on lawn chairs and blankets, food trucks glowing with string lights at the edge, early evening blue hour." },
  "covers/ev-trivia.webp": { shape: "cover", prompt: "Trivia night on a lively outdoor plaza, teams huddled at tables writing answers on paper, string lights overhead, evening." },
  "covers/ev-karaoke.webp": { shape: "cover", prompt: "Friends singing together into microphones in a cosy private karaoke room, colourful warm lights, laughing." },
  "covers/ev-edm-night.webp": { shape: "cover", prompt: "A warehouse dance floor with a DJ booth, colourful light beams through haze, the crowd seen from behind with hands up." },
  "covers/ev-warriors-watch.webp": { shape: "cover", prompt: "An outdoor basketball watch party on a plaza at night, a giant screen showing a generic basketball game, a crowd seen from behind cheering." },
  "covers/ev-sunset-yoga.webp": { shape: "cover", prompt: "An outdoor yoga class on a wide lawn at sunset, mats in loose rows, people in a gentle stretch, golden light." },
  "covers/ev-pickleball.webp": { shape: "cover", prompt: "Beginners playing pickleball on outdoor courts on a sunny afternoon, mixed doubles laughing, paddles and a yellow ball mid-air." },
  "covers/ev-jazz-plaza.webp": { shape: "cover", prompt: "A jazz trio with upright bass, saxophone and guitar playing on a sunny plaza, people relaxing on chairs under shade umbrellas." },
  "covers/ev-climb-comp.webp": { shape: "cover", prompt: "A climber reaching for a hold on a steep competition boulder wall, spectators cheering below, bright gym lights." },
  "covers/ev-house-show.webp": { shape: "cover", prompt: "An acoustic indie set in a backyard at dusk, a guitarist on a small rug stage, string lights, people sitting on blankets and folding chairs." },

  // Home feed photos (lib/mock/feed.ts)
  "feed/boulders-cave.webp": { shape: "photo", prompt: "Close view of a steep cave wall in a bouldering gym with freshly set colourful holds, chalk marks, a climber's hand reaching in, bright gym light." },
  "feed/runners-oval.webp": { shape: "photo", prompt: "A group of runners stretching and chatting beside a running track on a crisp morning, takeaway coffee cups on a bench, soft sunlight." },

  // Story frames (lib/mock/feed.ts STORIES), phone snapshots
  "stories/cafe-window.webp": { shape: "story", prompt: "A phone snapshot of a latte and a croissant on a small café table by a sunny window, cosy and personal." },
  "stories/golden-hills.webp": { shape: "story", prompt: "A phone snapshot from a hiking trail looking over golden California hills and oak trees, a friend walking ahead." },
  "stories/game-night.webp": { shape: "story", prompt: "A top-down phone snapshot of friends' hands around a board game with cards, wooden pieces and snacks on a table." },
  "stories/bay-sunset.webp": { shape: "story", prompt: "A phone snapshot of a pink and orange sunset over the bay from a wooden pier, calm water." },

  // Video thumbnails (lib/mock/feed.ts VIDEOS), 16:9 cropped from the cover shape
  "video/cave-wall-setting.webp": { shape: "cover", prompt: "A route setter on a ladder bolting colourful new holds onto a steep cave wall in a bouldering gym, a bucket of holds below, bright work light." },
  "video/three-bands.webp": { shape: "cover", prompt: "Three small indie bands' gear set up side by side on a cosy club stage before doors open, amps, guitars on stands, warm string lights." },
  "video/5k-route.webp": { shape: "cover", prompt: "A runner's view along a quiet tree-lined campus loop at dawn, a small group of runners ahead, soft mist." },

  // Profile pictures for the seeded Pages (simple, readable at 40px)
  "pages/indie-shows.webp": { shape: "square", prompt: "Close-up of an electric guitar headstock against warm blurred stage lights, simple composition, centred." },
  "pages/boulders.webp": { shape: "square", prompt: "Close-up of a chalky hand gripping a bright orange climbing hold, simple composition, centred." },
  "pages/runners.webp": { shape: "square", prompt: "Close-up of a pair of running shoes on a red running track lane, simple composition, centred." },
};
