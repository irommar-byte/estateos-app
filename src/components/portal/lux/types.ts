export type LuxPartnerFeedback = { companionId: number; name: string; sentiment: "like" | "maybe" | "dislike"; note: string | null };

export type LuxMatchOffer = {
  id: number;
  title: string;
  price: number;
  priceCurrency: string | null;
  city: string;
  district: string | null;
  street?: string | null;
  area: number;
  rooms?: number | null;
  description?: string | null;
  imageUrl: string;
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

export type LuxMatch = {
  id: number;
  score: number;
  clientFeedback: string | null;
  clientWhy?: string | null;
  favorite?: boolean;
  favoriteBadge?: string | null;
  partnerFeedback?: LuxPartnerFeedback[];
  offer: LuxMatchOffer;
};

export const SENTIMENT_LABEL: Record<string, string> = {
  like: "Chcę obejrzeć",
  maybe: "Do przemyślenia",
  dislike: "Nie pasuje",
};

export function matchSentiment(raw: string | null): "like" | "maybe" | "dislike" | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { sentiment?: string };
    const s = String(parsed.sentiment || "");
    return s === "like" || s === "maybe" || s === "dislike" ? s : null;
  } catch {
    return null;
  }
}

export function offerPpsm(offer: LuxMatchOffer): number | null {
  const p = Number(offer.price);
  const a = Number(offer.area);
  return p > 0 && a > 0 ? Math.round(p / a) : null;
}
