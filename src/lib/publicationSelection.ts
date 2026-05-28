import type { PublicationRedemption } from "@/components/publication/PublicationChoiceModal";

export type PublicationSelection = `coupon:${string}` | "plus_credit" | "buy_plus";

export function defaultPublicationSelection(input: {
  couponIds: string[];
  hasPlusCredit: boolean;
}): PublicationSelection {
  if (input.couponIds.length > 0) return `coupon:${input.couponIds[0]}`;
  if (input.hasPlusCredit) return "plus_credit";
  return "buy_plus";
}

export function publicationSelectionToRedemption(
  selection: PublicationSelection,
): PublicationRedemption | { action: "buy_plus" } {
  if (selection.startsWith("coupon:")) {
    return {
      kind: "FREE_FIRST",
      bonusCouponId: selection.replace("coupon:", ""),
    };
  }
  if (selection === "plus_credit") {
    return { kind: "PLUS_CREDIT", consumePlusPublication: true };
  }
  return { action: "buy_plus" };
}

export function publicationSelectionLabel(
  selection: PublicationSelection,
  locale: "pl" | "en" = "pl",
): string {
  if (selection === "buy_plus") {
    return locale === "en" ? "Go to payment" : "Przejdź do płatności";
  }
  if (selection === "plus_credit") {
    return locale === "en" ? "Publish with Plus credit" : "Opublikuj kredytem Plus";
  }
  return locale === "en" ? "Publish with coupon" : "Opublikuj kuponem";
}
