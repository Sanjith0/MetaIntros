import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAll } from "@/lib/seed/generate";

const root = process.cwd();
const out = generateAll();
const usersDir = path.join(root, "data", "mock-graph", "users");
rmSync(usersDir, { recursive: true, force: true });
mkdirSync(usersDir, { recursive: true });
for (const u of out.users) writeFileSync(path.join(usersDir, `${u.id}.json`), JSON.stringify(u, null, 2) + "\n");
const w = (f: string, v: unknown) => writeFileSync(path.join(root, "data", "seed", f), JSON.stringify(v, null, 2) + "\n");
w("chats.json", out.chats);
w("rsvps.json", out.rsvps);
w("blocks.json", out.blocks);
console.log(`wrote ${out.users.length} personas, ${out.chats.length} chats, ${out.rsvps.length} rsvps, ${out.blocks.length} blocks`);
