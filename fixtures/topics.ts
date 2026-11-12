/** A catalogue of topics used to give the 35 background profiles facts.
 *  Every fact a person "has" counts as written and approved by them in
 *  the fixtures, except where a profile marks one unapproved. */
export const TOPICS: Record<string, { text: string; ask: string }> = {
  "film photography": { text: "Into film photography", ask: "What are you shooting on lately?" },
  bouldering: { text: "Boulders a couple of times a week", ask: "Which gym do you climb at?" },
  "farmers market": { text: "Goes to the Sunday farmers market", ask: "What's worth buying at the market right now?" },
  portuguese: { text: "Learning Portuguese", ask: "How's the Portuguese going?" },
  "hot sauce": { text: "Makes hot sauce at home", ask: "What's in your latest batch?" },
  "pickup basketball": { text: "Plays pickup basketball", ask: "Where do you usually play?" },
  ceramics: { text: "Throws pots at a ceramics studio", ask: "What are you making at the studio?" },
  synths: { text: "Builds music on old synths", ask: "What are you working on musically?" },
  "board games": { text: "Hosts a board game night", ask: "What's the best game you've played this year?" },
  running: { text: "Runs along the waterfront", ask: "Training for anything?" },
  "sci-fi books": { text: "Reads a lot of science fiction", ask: "Read anything great lately?" },
  cooking: { text: "Cooks big Sunday dinners", ask: "What's your go-to dish?" },
  "trivia nights": { text: "Never misses a trivia night", ask: "What category do you carry the team on?" },
  gardening: { text: "Keeps a community garden plot", ask: "What's growing in your plot?" },
  cycling: { text: "Bikes everywhere in the city", ask: "Any favourite rides around here?" },
  "live jazz": { text: "Goes to live jazz on weeknights", ask: "Seen anyone good recently?" },
  "indie games": { text: "Plays small indie video games", ask: "What are you playing right now?" },
  hiking: { text: "Hikes most weekends", ask: "What's a trail you'd recommend?" },
  "language exchange": { text: "Goes to language exchange meetups", ask: "Which language are you practising?" },
  podcasts: { text: "Listens to too many podcasts", ask: "What should I be listening to?" },
};
