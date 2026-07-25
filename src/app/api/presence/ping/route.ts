import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/observability";
import { recordUserLogin } from "@/lib/recordUserLogin";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";
import { parseMobileUserIdFromAuthHeader } from "@/lib/mobileAuthUserId";

/** Heartbeat: marks current user as online (updates lastLoginAt). WWW cookie + mobile Bearer. */
export async function POST(req: Request) {
  let userId = await getAuthedUserIdFromRequest(req);
  if (!userId) {
    userId = parseMobileUserIdFromAuthHeader(req.headers.get("authorization"));
  }
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const ip = getClientIp(req);
  await recordUserLogin(userId, ip);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
