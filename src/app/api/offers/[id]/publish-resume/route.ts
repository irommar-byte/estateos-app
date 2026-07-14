import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { prisma } from "@/lib/prisma";
import { readPendingPublication } from "@/lib/offerPendingPublication";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: RouteContext) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = await context.params;
  const offerId = Number(params.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: "INVALID_OFFER_ID" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, status: true },
  });

  if (!offer || Number(offer.userId) !== Number(userId)) {
    return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404 });
  }

  const status = String(offer.status || "").toUpperCase();
  const pending = await readPendingPublication(offerId);
  const awaitingReview = Boolean(pending?.kind);
  const reusable = status === "PENDING" && !awaitingReview;

  return NextResponse.json({
    ok: true,
    offerId,
    status,
    awaitingReview,
    reusable,
  });
}
