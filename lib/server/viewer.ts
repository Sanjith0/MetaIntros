import { cookies } from "next/headers";
import { store } from "./store";

export const VIEWER_COOKIE = "pq_viewer";
export const DEFAULT_VIEWER = "maya";

/** The demo user switcher decides who you are. There is no login. */
export async function currentViewerId(): Promise<string> {
  const jar = await cookies();
  const id = jar.get(VIEWER_COOKIE)?.value;
  return id && store().profiles.has(id) ? id : DEFAULT_VIEWER;
}
