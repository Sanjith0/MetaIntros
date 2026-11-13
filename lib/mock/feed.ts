/**
 * Seeded content for the tabs outside the Link hero path (Home, Video). Colours here are content, not
 * design tokens; photos are Muse-generated stand-ins in public/images (scripts/gen-images.ts). Nothing here
 * comes from Facebook.
 */
export const POSTS = [
  { id: "p1", who: "Bay Area Indie Shows", color: "#0f766e", avatar: "/images/pages/indie-shows.webp", ago: "1h", text: "Who's going to Indie Night at The Guild this weekend? Four local bands, doors at 7:30.", eventId: "ev-indie-guild", likes: 86, comments: 14 },
  { id: "p2", who: "Peninsula Boulders", color: "#c2410c", avatar: "/images/pages/boulders.webp", ago: "2h", text: "New problems set on the cave wall this week. Come try the new V3 in the back corner.", photo: "/images/feed/boulders-cave.webp", likes: 41, comments: 6 },
  { id: "p3", who: "Palo Alto Runners", color: "#b45309", avatar: "/images/pages/runners.webp", ago: "5h", text: "Saturday 5K is on. Meet at the Oval at 8, coffee after.", photo: "/images/feed/runners-oval.webp", likes: 23, comments: 3 },
];

export const STORIES = [
  { id: "s1", name: "Freya Rossi", color: "#be123c", pattern: "dots", photo: "/images/stories/cafe-window.webp" },
  { id: "s2", name: "Reza Ali", color: "#15803d", pattern: "waves", photo: "/images/stories/golden-hills.webp" },
  { id: "s3", name: "Yuki Doi", color: "#4338ca", pattern: "rings", photo: "/images/stories/game-night.webp" },
  { id: "s4", name: "Rowan Müller", color: "#0e7490", pattern: "stripes", photo: "/images/stories/bay-sunset.webp" },
];

export const VIDEOS = [
  { id: "v1", page: "Peninsula Boulders", color: "#c2410c", pattern: "diamonds", avatar: "/images/pages/boulders.webp", thumb: "/images/video/cave-wall-setting.webp", title: "Setting the new cave wall, start to finish", views: "12K views", ago: "2d" },
  { id: "v2", page: "Bay Area Indie Shows", color: "#0f766e", pattern: "rings", avatar: "/images/pages/indie-shows.webp", thumb: "/images/video/three-bands.webp", title: "Three local bands you can see this weekend", views: "4.1K views", ago: "5h" },
  { id: "v3", page: "Palo Alto Runners", color: "#b45309", pattern: "stripes", avatar: "/images/pages/runners.webp", thumb: "/images/video/5k-route.webp", title: "Saturday 5K route walk-through", views: "980 views", ago: "1w" },
];
