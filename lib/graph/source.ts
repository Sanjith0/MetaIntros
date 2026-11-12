import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { GraphUser } from "./schema";

/**
 * Where user Graph data comes from. MockGraphSource reads /data/mock-graph;
 * a real implementation would call graph.facebook.com/{id}?fields=... with a user token.
 */
export interface GraphSource {
  listUserIds(): string[];
  getUser(id: string): GraphUser;
}

export class MockGraphSource implements GraphSource {
  constructor(private dir = path.join(process.cwd(), "data", "mock-graph", "users")) {}

  listUserIds(): string[] {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  }

  getUser(id: string): GraphUser {
    const raw = JSON.parse(readFileSync(path.join(this.dir, `${id}.json`), "utf8"));
    return GraphUser.parse(raw);
  }
}
