import { state, view } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId");
  const crews = [...state().crews.values()].filter((c) => !userId || c.memberIds.includes(userId)).map(view);
  return Response.json(crews);
}
