import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { getPublicationQuote, submitOfferActivation } from "@/lib/offerPublication";
import { markProfilePromoCardUsed } from "@/lib/profilePromoCards";
import { notifyManagersAboutOwnCreditListing, submitOfferForOfficeActivation } from "@/lib/crm/officeOfferReview";

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

    // Kredyt biura: kierownik publikuje od razu, agent w ramach limitu też, pozostali wysyłają prośbę do kierownika.
    if (pub?.kind === "OFFICE_CREDIT") {
      const office = await submitOfferForOfficeActivation({ offerId, actorUserId: userId });
      if (!office.ok) {
        return NextResponse.json(
          { errorCode: office.code || "OFFICE_REVIEW_FAILED", message: office.error },
          { status: office.status || 400 },
        );
      }
      const awaitingOffice = office.status === "OFFICE_REVIEW";
      return NextResponse.json({
        success: true,
        offerId,
        awaitingOffice,
        awaitingModeration: Boolean(office.awaitingModeration),
        publication: { status: awaitingOffice ? "PENDING" : office.awaitingModeration ? "PENDING" : "ACTIVE", kind: "OFFICE_CREDIT" },
        message: awaitingOffice
          ? "Prośba trafiła do kierownika biura. Gdy zatwierdzi, ogłoszenie zostanie opłacone z kredytu biura."
          : office.awaitingModeration
            ? "Opłacone z kredytu biura — ogłoszenie czeka na weryfikację EstateOS."
            : "Ogłoszenie jest na rynku — opłacone z kredytu biura.",
      });
    }
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
          message: "Wystawienie tej oferty wymaga 1 kredytu Pakietu Plus.",
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

    const staged = await submitOfferActivation({
      userId,
      offerId,
      kind: activationKind,
      bonusCouponId: bonusCouponId || null,
      iapTransactionId: activationKind === "PLUS_PAID" ? txId : null,
      iapProductId: quote.productId,
      onFreeFirstCouponUsed: markProfilePromoCardUsed,
    });

    // Agent biura z własnych kredytów: publikacja liczy się jako biurowa, kierownik dostaje informację.
    if (!staged.alreadyActive && activationKind === "PLUS_CREDIT") {
      void notifyManagersAboutOwnCreditListing({ userId, offerId }).catch(() => undefined);
    }

    if (staged.alreadyActive) {
      return NextResponse.json({
        success: true,
        offerId,
        publication: { status: "ACTIVE", kind: null },
      });
    }

    if (!staged.awaitingModeration) {
      return NextResponse.json({
        success: true,
        offerId,
        awaitingModeration: false,
        publication: {
          status: staged.status,
          kind: staged.kind,
          endsAt: staged.endsAt?.toISOString?.() ?? null,
        },
        message: "Oferta jest aktywna na rynku.",
      });
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
    if (message === "NO_PLUS_CREDIT_AVAILABLE" || message === "FREE_PUBLICATION_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          errorCode: "PUBLICATION_REQUIRES_PLUS",
          message:
            message === "FREE_PUBLICATION_NOT_AVAILABLE"
              ? "Darmowa publikacja przysługuje tylko przy pierwszej ofercie prywatnego użytkownika. Wystaw ofertę za 1 kredyt Pakietu Plus."
              : "Brak dostępnego kredytu Pakietu Plus.",
        },
        { status: 409 },
      );
    }
    if (message === "OFFER_ARCHIVED") {
      return NextResponse.json({ errorCode: "OFFER_ARCHIVED", message: "Ta oferta została wycofana i jest w archiwum. Żeby wrócić na rynek, wystaw ją jako nową ofertę." }, { status: 409 });
    }
    const status = message === "OFFER_NOT_FOUND_OR_FORBIDDEN" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
