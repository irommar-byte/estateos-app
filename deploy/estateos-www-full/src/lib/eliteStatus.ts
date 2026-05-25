import {
  isAgentOfferIdentity,
  isAgentRoleIdentity,
  isInvestorProIdentity,
  isPartnerIdentity,
} from "@/utils/partnerIdentity";

export type EliteBadges = {
  /** Pomarańczowy pin / oferta agentska */
  isAgentOffer: boolean;
  /** Plakietka „Agent EstateOS” (rola AGENT) */
  isAgent: boolean;
  /** Plakietka programu partnerskiego (legacy PARTNER/AGENCY) */
  isProgramPartner: boolean;
  /** Investor Pro — Radar bez embargo, PRO w CRM */
  isInvestorPro: boolean;
  /** Kompatybilność API/map — agent lub program partner */
  isPartner: boolean;
};

/** @deprecated Użyj `resolveEliteBadges` — zachowane dla mapy/list. */
export type LegacyEliteBadges = {
  isPartner: boolean;
  isInvestorPro: boolean;
};

export function resolveEliteBadges(subject: any): EliteBadges {
  if (!subject || typeof subject !== "object") {
    return {
      isAgentOffer: false,
      isAgent: false,
      isProgramPartner: false,
      isInvestorPro: false,
      isPartner: false,
    };
  }

  const isAgent = isAgentRoleIdentity(subject);
  const isProgramPartner = isPartnerIdentity(subject) && !isAgent;
  const isAgentOffer = isAgentOfferIdentity(subject);
  return {
    isAgentOffer,
    isAgent,
    isProgramPartner,
    isInvestorPro: isInvestorProIdentity(subject),
    isPartner: isAgentOffer || isProgramPartner,
  };
}

/** Kompatybilność wsteczna: `isPartner` = agent na mapie LUB program partner. */
export function resolveLegacyEliteBadges(subject: any): LegacyEliteBadges {
  const b = resolveEliteBadges(subject);
  return {
    isPartner: b.isAgentOffer || b.isProgramPartner,
    isInvestorPro: b.isInvestorPro,
  };
}
