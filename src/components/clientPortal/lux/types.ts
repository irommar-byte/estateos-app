import type { ClientPortalPayload, PortalMatch, PortalOffer } from '../../../services/clientPortalService';

/** Pola panelu v2 (te same co na www) — dokładane do starego payloadu. */
export type LuxOffer = PortalOffer & {
  street?: string | null;
  description?: string | null;
  imageUrls?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  yearBuilt?: number | null;
  hasBalcony?: boolean | null;
  hasParking?: boolean | null;
  hasElevator?: boolean | null;
  hasGarden?: boolean | null;
  floorPlanUrl?: string | null;
  status?: string | null;
  listedAt?: string | null;
};

export type LuxPartnerFeedback = { companionId: number; name: string; sentiment: 'like' | 'maybe' | 'dislike'; note: string | null };

export type LuxMatch = Omit<PortalMatch, 'offer'> & {
  favorite?: boolean;
  favoriteBadge?: string | null;
  partnerFeedback?: LuxPartnerFeedback[];
  offer: LuxOffer;
};

export type LuxPermissions = {
  selfBooking: boolean;
  criteriaEdit: boolean;
  earlyAccess: boolean;
  partnerAccess: boolean;
  sellerStats: boolean;
  sellerFeedback: boolean;
  sellerCompetition: boolean;
  weeklyDigest: boolean;
  viewingReminders?: boolean;
  documents?: boolean;
};

export type LuxDocument = {
  key: string;
  label: string;
  hint: string | null;
  required: boolean;
  status: 'missing' | 'uploaded' | 'accepted' | 'rejected' | 'na';
  fileName: string | null;
  fileUrl: string | null;
  note: string | null;
  uploadedAt: string | null;
};

export type LuxBuyerOffer = {
  id: number;
  buyerLabel: string;
  amount: number;
  financing: string;
  deposit: number | null;
  deedWeeks: number | null;
  handoverDays: number | null;
  note: string | null;
  recommendation: string | null;
  recommendationKind: string | null;
  status: string;
  clientResponse: string | null;
  clientComment: string | null;
  counterAmount: number | null;
  respondBy: string | null;
};

export type LuxSeller = {
  stats: { views: number; matches: number; showings: number; buyerOffers: number } | null;
  buyerOffers: LuxBuyerOffer[];
  showingFeedback: { showings: number; items: Array<{ tag: string; count: number; negative: boolean }> } | null;
  competition: {
    ownPpsm: number | null;
    ownDays: number;
    similarCount: number;
    similarPpsm: number | null;
    similarDays: number | null;
    transactionPpsm: number | null;
    transactionCount: number;
  } | null;
  finance: {
    mortgageBalance: number | null;
    purchaseYear: number | null;
    purchasePrice: number | null;
    commissionPct: number | null;
    commissionVat: boolean;
    otherCosts: number | null;
  };
  netAtListPrice: { net: number } | null;
};

export type LuxCompanion = { id: number; name: string; url: string; lastSeenAt: string | null };

export type LuxPortal = Omit<ClientPortalPayload, 'matches'> & {
  matches: LuxMatch[];
  viewer?: { role: 'owner' } | { role: 'partner'; companionId: number; name: string };
  greeting?: string;
  clientFirstName?: string;
  permissions?: LuxPermissions;
  companions?: LuxCompanion[];
  searchPolygon?: Array<[number, number]> | null;
  seller?: LuxSeller | null;
  documents?: LuxDocument[];
  documentsSummary?: { total?: number; required: number; done: number; missing: number; toReview: number };
  review?: { rating: number; comment: string | null; at: string } | null;
  reviewLink?: string;
  agencyLogo?: string | null;
  agencyPhone?: string | null;
  searchCriteria?: { location?: string | null; maxBudget?: string | null; minRooms?: number | null } | null;
  listing?: (ClientPortalPayload['listing'] & { createdAt?: string | null; area?: number | null }) | null;
};
