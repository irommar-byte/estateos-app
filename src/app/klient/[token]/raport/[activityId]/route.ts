import { NextResponse } from "next/server";
import { loadPortalMarketReport } from "@/lib/market/loadPortalMarketReport";

type RouteCtx = { params: Promise<{ token: string; activityId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token, activityId } = await ctx.params;
  const loaded = await loadPortalMarketReport({
    portalToken: token,
    activityId: Number(activityId),
  });
  return new NextResponse(loaded.html, {
    status: loaded.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
