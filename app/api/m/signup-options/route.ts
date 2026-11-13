import { NextResponse } from "next/server";
import { SIGNUP_CHIPS } from "@/lib/graph/vocabulary";
import { AVAIL_SLOTS } from "@/lib/signup";

/** The sign-up choices, for the Expo app's judge sign-up screen. */
export function GET() {
  return NextResponse.json({ chips: SIGNUP_CHIPS.map((c) => ({ tag: c.tag, label: c.label })), slots: AVAIL_SLOTS.map((s) => ({ id: s.id, label: s.label })) });
}
