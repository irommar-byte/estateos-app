import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/observability";
import { recordUserLogin } from "@/lib/recordUserLogin";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";

/** Heartbeat: marks current user as online (updates lastLoginAt). */
export async function POST(req: Request) {
  const userId = await getAuthedUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const ip = getClientIp(req);
  await recordUserLogin(userId, ip);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
