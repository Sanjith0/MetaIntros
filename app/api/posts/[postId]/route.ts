import { NextResponse } from "next/server";
import { deletePost } from "@/lib/server/posts";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Author only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const ok = await deletePost(await getCurrentUserId(), postId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
