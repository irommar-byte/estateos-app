import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { getPublicationQuote, stageOfferPublicationForReview } from "@/lib/offerPublication";
import { markProfilePromoCardUsed } from "@/lib/profilePromoCards";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: RouteContext) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = await context.params;
  const offerId = Number(params.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: "INVALID_OFFER_ID" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const quote = await getPublicationQuote({ userId, offerId, action: "ACTIVATE" });
    if (quote.reason === "ALREADY_ACTIVE") {
      return NextResponse.json({
        success: true,
        offerId,
        publication: { status: "ACTIVE", kind: null },
      });
    }

    const pub = (body?.publication ?? body) as Record<string, unknown>;
    const txId = String(body?.iapTransactionId ?? pub?.iapTransactionId ?? "").trim();
    const bonusCouponId = String(pub?.bonusCouponId ?? body?.bonusCouponId ?? "").trim();
    const bypassPaymentRequirement =
      pub?.kind === "FREE_FIRST" ||
      Boolean(bonusCouponId) ||
      pub?.kind === "PLUS_CREDIT" ||
      pub?.consumePlusPublication === true;

    if (quote.requiresPayment && !txId && !bypassPaymentRequirement) {
      return NextResponse.json(
        {
          errorCode: "PUBLICATION_REQUIRES_PLUS",
          message: "Publikacja tego ogłoszenia na 30 dni wymaga Pakiet Plus.",
          quote,
        },
        { status: 422 },
      );
    }

    const activationKind =
      pub?.kind === "PLUS_PAID" || (txId && pub?.kind !== "FREE_FIRST" && pub?.kind !== "PLUS_CREDIT")
        ? "PLUS_PAID"
        : pub?.kind === "PLUS_CREDIT" || pub?.consumePlusPublication === true
          ? "PLUS_CREDIT"
          : pub?.kind === "FREE_FIRST" || bonusCouponId
            ? "FREE_FIRST"
            : txId
              ? "PLUS_PAID"
              : "PLUS_CREDIT";

    const staged = await stageOfferPublicationForReview({
      userId,
      offerId,
      kind: activationKind,
      bonusCouponId: bonusCouponId || null,
      iapTransactionId: activationKind === "PLUS_PAID" ? txId : null,
      iapProductId: quote.productId,
    });

    if (bonusCouponId && activationKind === "FREE_FIRST") {
      await markProfilePromoCardUsed(userId, bonusCouponId);
    }

    return NextResponse.json({
      success: true,
      offerId,
      awaitingModeration: true,
      publication: {
        status: staged.status,
        kind: staged.kind,
      },
      message:
        "Oferta została przesłana do weryfikacji. Po akceptacji pojawi się na mapie i rynku.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "IAP_TRANSACTION_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          errorCode: "IAP_TRANSACTION_NOT_AVAILABLE",
          message: "Nie znaleziono niewykorzystanej płatności za publikację.",
        },
        { status: 409 },
      );
    }
    if (message === "NO_PLUS_CREDIT_AVAILABLE") {
      return NextResponse.json(
        {
          errorCode: "PUBLICATION_REQUIRES_PLUS",
          message: "Brak dostępnego kredytu Pakietu Plus.",
        },
        { status: 409 },
      );
    }
    const status = message === "OFFER_NOT_FOUND_OR_FORBIDDEN" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
