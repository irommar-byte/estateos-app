import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  retryPendingMarketingNotifications,
  tickSellerMarketingRenewals,
} from "@/lib/crm/sellerMarketing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function cronSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    ""
  );
}

function isAuthorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function run(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const [renewals, notifications] = await Promise.all([
    tickSellerMarketingRenewals(),
    retryPendingMarketingNotifications(),
  ]);
  return NextResponse.json({ ok: true, renewals, notifications });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
