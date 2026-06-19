import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { getCreatePublicationQuote, getPublicationQuote } from "@/lib/offerPublication";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const offerIdRaw = searchParams.get("offerId");
  const offerId = offerIdRaw ? Number(offerIdRaw) : null;

  try {
    if (offerId && Number.isFinite(offerId) && offerId > 0) {
      const quote = await getPublicationQuote({ userId, offerId, action: "ACTIVATE" });
      return NextResponse.json({ success: true, quote });
    }
    const quote = await getCreatePublicationQuote({ userId });
    return NextResponse.json({ success: true, quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "OFFER_NOT_FOUND_OR_FORBIDDEN" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
