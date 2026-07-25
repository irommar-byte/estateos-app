import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSellerOnlineFromLastLogin } from "@/lib/offerGuestInquiry";

/** Public presence check for a user id (seller lamp on offer page). */
export async function GET(req: Request) {
  const userId = Number(new URL(req.url).searchParams.get("userId") || 0);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ isOnline: false }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLoginAt: true },
  });
  return NextResponse.json({
    isOnline: isSellerOnlineFromLastLogin(user?.lastLoginAt),
  });
}
