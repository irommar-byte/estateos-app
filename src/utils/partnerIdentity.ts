/**
 * Kanoniczna tożsamość użytkownika/oferty — zgodna z aplikacją mobilną (`src/utils/partnerIdentity.ts`).
 */

function collectRoleCandidates(input: any): string[] {
  if (!input || typeof input !== "object") return [];
  return [
    input.role,
    input.userRole,
    input.accountType,
    input.planType,
    input.type,
    input.user?.role,
    input.user?.userRole,
    input.user?.accountType,
    input.user?.planType,
    input.owner?.role,
    input.owner?.accountType,
    input.owner?.planType,
    input.seller?.role,
    input.seller?.accountType,
    input.seller?.planType,
  ]
    .map((v) => String(v || "").trim().toUpperCase())
    .filter(Boolean);
}

/** Program partnerski / agencyjny marketing (PARTNER, BROKER, plan AGENCY) — nie sama rola AGENT. */
export function isPartnerIdentity(input: any): boolean {
  if (!input || typeof input !== "object") return false;
  if (input.isPartner === true || input.partner === true) return true;
  return collectRoleCandidates(input).some(
    (x) => x === "PARTNER" || x === "BROKER" || x === "AGENCY"
  );
}

/** Rola mobilna AGENT (biuro nieruchomości) — plakietka „Agent”, nie „Partner”. */
export function isAgentRoleIdentity(input: any): boolean {
  return collectRoleCandidates(input).some((x) => x === "AGENT");
}

/**
 * Oferta / pin na mapie — agent zawodowy (AGENT + legacy partner/agency).
 * Jak `isAgentOfferRaw` w aplikacji.
 */
export function isAgentOfferIdentity(input: any): boolean {
  if (!input || typeof input !== "object") return false;
  if (
    input.isPartner === true ||
    input.partner === true ||
    input.isAgency === true ||
    input.agency === true ||
    input.isProAgency === true ||
    input.isAgent === true
  ) {
    return true;
  }
  return collectRoleCandidates(input).some(
    (x) => x === "AGENT" || x === "PARTNER" || x === "AGENCY" || x === "BROKER"
  );
}

/** Investor Pro (Radar bez opóźnienia, PRO widget) — wyłącznie subskrypcja PRO, nie rola AGENT. */
export function isInvestorProIdentity(input: any): boolean {
  if (!input || typeof input !== "object") return false;

  const plusSignals = [
    input.planType,
    input.subscriptionPlan,
    input.subscriptionTier,
    input.tier,
    input.type,
    input.user?.planType,
    input.user?.subscriptionPlan,
    input.user?.subscriptionTier,
    input.user?.tier,
    input.user?.type,
  ]
    .map((v) => String(v || "").trim().toUpperCase())
    .filter(Boolean);

  const hasPlusEntitlement =
    plusSignals.some((x) => x === "PLUS" || x === "PAKIET_PLUS" || x === "PAKIET-PLUS") ||
    Boolean(input.plusExpiresAt || input.user?.plusExpiresAt) ||
    Number(input.extraListings ?? input.user?.extraListings ?? 0) > 0;

  if (hasPlusEntitlement && !plusSignals.some((x) => x.includes("PRO"))) {
    return false;
  }

  if (input.isPro === true || input.user?.isPro === true) {
    const plan = String(input.planType || input.user?.planType || "").toUpperCase();
    if (plan === "PLUS") return false;
    return true;
  }

  const subscriptionStatus = String(
    input.subscriptionStatus || input.user?.subscriptionStatus || ""
  )
    .trim()
    .toUpperCase();

  if (
    ["ACTIVE", "TRIALING", "PAID", "OK"].includes(subscriptionStatus) &&
    plusSignals.some((x) => x.includes("PRO"))
  ) {
    return true;
  }

  return plusSignals.some(
    (x) =>
      x === "INVESTOR_PRO" ||
      x === "PRO" ||
      x === "INVESTOR-PRO" ||
      x === "INVESTOR PRO"
  );
}
