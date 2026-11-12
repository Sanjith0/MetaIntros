/** Labeled sentences for brief extraction. Each lists the hard rules a
 *  careful human would read out of it (kind and value). */
export const BRIEF_CASES: { sentence: string; rules: Record<string, string | number | boolean> }[] = [
  { sentence: "chill people, out by eleven, under twenty bucks, nowhere I have to drink", rules: { end_by: "23:00", max_price: 20, no_drink_minimum: true } },
  { sentence: "something with music, I'm fine spending up to 40, want to try something new", rules: { max_price: 40 } },
  { sentence: "outdoors if possible, low-key, home by midnight", rules: { end_by: "00:00" } },
  { sentence: "games or something hands-on, nothing too loud", rules: {} },
  { sentence: "open to anything, just want to meet people, budget around 25", rules: { max_price: 25 } },
  { sentence: "home by 10, sober night please", rules: { end_by: "22:00", no_drink_minimum: true } },
  { sentence: "less than $15 and somewhere public", rules: { max_price: 15, public_venue: true } },
  { sentence: "done by 10:30, no drink minimum", rules: { end_by: "22:30", no_drink_minimum: true } },
  { sentence: "I don't drink, anything under 30 is fine", rules: { no_drink_minimum: true, max_price: 30 } },
  { sentence: "quiet dinner, max 50 dollars", rules: { max_price: 50 } },
  { sentence: "back by nine, in public", rules: { end_by: "21:00", public_venue: true } },
  { sentence: "live music, no more than twenty", rules: { max_price: 20 } },
  { sentence: "trivia or board games, leave by eleven", rules: { end_by: "23:00" } },
  { sentence: "something outside, budget of 10", rules: { max_price: 10 } },
  { sentence: "nowhere we have to drink, out by twelve", rules: { no_drink_minimum: true, end_by: "00:00" } },
  { sentence: "I want to dance all night", rules: {} },
  { sentence: "finished by 11pm, below 35", rules: { end_by: "23:00", max_price: 35 } },
  { sentence: "food and friends, no alcohol, home before eleven", rules: { no_drink_minimum: true, end_by: "23:00" } },
  { sentence: "cheap and cheerful, under ten bucks", rules: { max_price: 10 } },
  { sentence: "meet new people somewhere public, out by 10", rules: { public_venue: true, end_by: "22:00" } },
];

/** Sentence pool for generated parties in the privacy and feasibility sweeps. */
export const SENTENCE_POOL = [
  "chill people, out by eleven, under twenty bucks, nowhere I have to drink",
  "something with music, I'm fine spending up to 40, want to try something new",
  "outdoors if possible, low-key, home by midnight",
  "games or something hands-on, nothing too loud",
  "open to anything, just want to meet people, budget around 25",
  "home by 10, sober night please",
  "less than $15 and somewhere public",
  "I don't drink, anything under 30 is fine",
  "trivia or board games, leave by eleven",
  "food and friends, no alcohol, home before eleven",
  "live music, no more than twenty",
  "cheap and cheerful, under ten bucks",
];

/** Lines a leaky agent might try to post, with the sources it claims. */
export const PLANTED_LEAKS: { text: string; sourceIds: string[] }[] = [
  { text: "I can't do the rooftop, I don't drink", sourceIds: ["neutral-works"] },
  { text: "Has to be under twenty bucks for me", sourceIds: ["neutral-in"] },
  { text: "I need to be out by eleven", sourceIds: [] },
  { text: "out by eleven", sourceIds: ["hr-OWNER-end"] },
  { text: "nowhere I have to drink", sourceIds: ["hr-OWNER-drink"] },
  { text: "Up for something low-key. Also out by eleven.", sourceIds: ["sl-OWNER-chill"] },
  { text: "That works for me. Not the rooftop though.", sourceIds: ["neutral-works"] },
  { text: "Up for something low-key", sourceIds: ["sl-OWNER-chill", "neutral-in", "neutral-works"] },
  { text: "About me: moved here after a hard year.", sourceIds: ["sl-OWNER-f5"] },
  { text: "I'm in.", sourceIds: ["sl-SOMEONE-ELSE"] },
  { text: "chill people, out by eleven, under twenty bucks, nowhere I have to drink", sourceIds: ["neutral-works"] },
  { text: "The supper is too expensive for me", sourceIds: ["neutral-either"] },
];
