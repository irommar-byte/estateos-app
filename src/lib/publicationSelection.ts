import type { PublicationRedemption } from "@/components/publication/PublicationChoiceModal";

export type PublicationSelection = `coupon:${string}` | "plus_credit" | "buy_plus" | "pay_renewal";

export function defaultPublicationSelection(
  input: {
    couponIds: string[];
    hasPlusCredit: boolean;
  },
  mode: "publish" | "renew" = "publish",
): PublicationSelection {
  if (input.couponIds.length > 0) return `coupon:${input.couponIds[0]}`;
  if (input.hasPlusCredit) return "plus_credit";
  return mode === "renew" ? "pay_renewal" : "buy_plus";
}

export function publicationSelectionToRedemption(
  selection: PublicationSelection,
): PublicationRedemption | { action: "buy_plus" | "pay_renewal" } {
  if (selection.startsWith("coupon:")) {
    return {
      kind: "FREE_FIRST",
      bonusCouponId: selection.replace("coupon:", ""),
    };
  }
  if (selection === "plus_credit") {
    return { kind: "PLUS_CREDIT", consumePlusPublication: true };
  }
  if (selection === "pay_renewal") {
    return { action: "pay_renewal" };
  }
  return { action: "buy_plus" };
}

export function publicationSelectionLabel(
  selection: PublicationSelection,
  locale: "pl" | "en" = "pl",
): string {
  if (selection === "pay_renewal") {
    return locale === "en" ? "Pay renewal" : "Opłać odnowienie";
  }
  if (selection === "buy_plus") {
    return locale === "en" ? "Go to payment" : "Przejdź do płatności";
  }
  if (selection === "plus_credit") {
    return locale === "en" ? "Publish with Plus credit" : "Opublikuj kredytem Plus";
  }
  return locale === "en" ? "Publish with coupon" : "Opublikuj kuponem";
}
