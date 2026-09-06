import { NextResponse } from "next/server";
import { checkMailAliasAvailability } from "@/lib/purchaseMailAlias";

const hits = new Map<string, { n: number; t: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const current = hits.get(ip);
  if (!current || now - current.t > windowMs) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  current.n += 1;
  return current.n > 40;
}

export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
  }

  const url = new URL(req.url);
  const q = String(url.searchParams.get("alias") || "");
  if (!q.trim()) {
    return NextResponse.json({
      ok: true,
      alias: "",
      address: "",
      available: false,
      reason: "invalid",
    });
  }

  try {
    const result = await checkMailAliasAvailability(q);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[mail-alias/check]", error);
    return NextResponse.json({ ok: false, error: "CHECK_FAILED" }, { status: 500 });
  }
}
