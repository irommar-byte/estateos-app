import type { PublicationKind } from "@/lib/offerPublication";
import { stageOfferPublicationForReview } from "@/lib/offerPublication";
import { markProfilePromoCardUsed } from "@/lib/profilePromoCards";

export type OtodomPublicationInput = {
  kind?: string;
  bonusCouponId?: string;
  iapTransactionId?: string;
  consumePlusPublication?: boolean;
};

export function resolveOtodomPublicationKind(
  pub: OtodomPublicationInput,
  txId: string,
): PublicationKind {
  if (pub.kind === "PLUS_PAID" || (txId && pub.kind !== "FREE_FIRST" && pub.kind !== "PLUS_CREDIT")) {
    return "PLUS_PAID";
  }
  if (pub.kind === "PLUS_CREDIT" || pub.consumePlusPublication === true) {
    return "PLUS_CREDIT";
  }
  if (pub.kind === "FREE_FIRST" || pub.bonusCouponId) {
    return "FREE_FIRST";
  }
  return txId ? "PLUS_PAID" : "PLUS_CREDIT";
}

export async function stageOtodomImportPublication(params: {
  userId: number;
  offerId: number;
  publication: OtodomPublicationInput;
}) {
  const pub = params.publication;
  const txId = String(pub.iapTransactionId ?? "").trim();
  const kind = resolveOtodomPublicationKind(pub, txId);
  const bonusCouponId = pub.bonusCouponId ? String(pub.bonusCouponId).trim() : "";

  const staged = await stageOfferPublicationForReview({
    userId: params.userId,
    offerId: params.offerId,
    kind,
    bonusCouponId: bonusCouponId || null,
    iapTransactionId: kind === "PLUS_PAID" ? txId : null,
  });

  if (bonusCouponId && kind === "FREE_FIRST") {
    await markProfilePromoCardUsed(params.userId, bonusCouponId);
  }

  return staged;
}
