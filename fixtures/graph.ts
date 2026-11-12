import type { FriendEdge, Group } from "@/contracts";

/** Groups with member counts. Only Groups under 200 members count as a
 *  bridge; the 12k nightlife Group is deliberately too big to count. */
export const GROUPS: Group[] = [
  { id: "grp-portuguese", name: "Portuguese Practice SF", size: 45 },
  { id: "grp-ceramics", name: "Mission Ceramics Collective", size: 64 },
  { id: "grp-bouldering", name: "Bay Bouldering Crew", size: 180 },
  { id: "grp-jazz", name: "Weeknight Jazz Club", size: 120 },
  { id: "grp-cyclists", name: "Bay Bike Commuters", size: 950 },
  { id: "grp-board-games", name: "East Bay Board Gamers", size: 88 },
  { id: "grp-gardeners", name: "Community Garden Plotholders", size: 140 },
  { id: "grp-runners", name: "Lake Loop Runners", size: 199 },
  { id: "grp-big-climbing", name: "Climbing Everywhere", size: 200 },
  { id: "grp-sf-nightlife", name: "SF Events and Nightlife", size: 12000 },
  // Everyone who joins through the fair QR is in this Group: their bridge to each other.
  { id: "grp-fair", name: "Fair guests tonight", size: 150 },
];

/** Undirected friendships. The five demo members are not friends with
 *  each other; they connect through mutual friends and small Groups. */
export const FRIENDS: FriendEdge[] = [
  // Maya and Dev both know Priya.
  ["maya", "priya"],
  ["dev", "priya"],
  // Dev and Kai both know Theo.
  ["dev", "theo"],
  ["kai", "theo"],
  // Zoe and Ana each also know Sam.
  ["zoe", "sam"],
  ["ana", "sam"],
  // Background graph.
  ["priya", "theo"],
  ["priya", "sam"],
  ["jules", "hana"],
  ["hana", "ivy"],
  ["ivy", "leo"],
  ["marcus", "amara"],
  ["amara", "felix"],
  ["felix", "jules"],
  ["sofia", "ben"],
  ["ben", "mei"],
  ["mei", "rafa"],
  ["rafa", "quinn"],
  ["quinn", "elena"],
  ["elena", "tom"],
  ["aisha", "noah"],
  ["noah", "grace"],
  ["grace", "luca"],
  ["luca", "tara"],
  ["tara", "owen"],
  ["owen", "yara"],
  ["eli", "chloe"],
  ["chloe", "ravi"],
  ["ravi", "mira"],
  ["mira", "dante"],
  ["dante", "june"],
  ["june", "alex"],
  ["nina", "sam"],
  ["rosa", "priya"],
  ["omar", "theo"],
];
