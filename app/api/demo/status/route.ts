import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { demoStatus } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await demoStatus();
  // Prefer an explicit public URL (tunnel); else whatever host the presenter opened /demo on.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  // Tunnels set x-forwarded-proto=https; a plain LAN address (http://192.168.x.x:3000) must stay http.
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? new URL(req.url).protocol.replace(":", "");
  const joinUrl = `${process.env.PUBLIC_URL ?? `${proto}://${host}`}/join`;
  const qr = await QRCode.toString(joinUrl, { type: "svg", margin: 1, width: 220, color: { dark: "#0b1640", light: "#ffffff" } });
  return NextResponse.json({ ...s, joinUrl, qr });
}
